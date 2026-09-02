import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies, logAdminAction } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function cf() {
  const { env } = getCloudflareContext();
  const c = env as any;
  if (!c.CF_ACCOUNT_ID || !c.CF_API_EMAIL || !c.CF_API_TOKEN) throw new Error("Konfigurasi Cloudflare belum lengkap");
  return c;
}
async function cfApi(path: string, init: RequestInit = {}) {
  const c = cf();
  return fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}
async function deleteEmailRule(zoneId: string, ruleId: string) {
  const res = await cfApi(`/zones/${zoneId}/email/routing/rules/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Email rule delete failed: ${res.status}`);
}
async function detachWorkerDomain(domain: string) {
  const c = cf();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.CF_ACCOUNT_ID}/workers/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
    headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Worker domain detach failed: ${res.status}`);
}
async function deleteResendDns(zoneId: string, domain: string) {
  try {
    const listRes = await cfApi(`/zones/${zoneId}/dns_records?per_page=100`);
    const list: any = await listRes.json().catch(() => ({}));
    const records: any[] = list.result || [];
    for (const rec of records) {
      const isResend =
        rec.name === domain || rec.name.endsWith(`.${domain}`) ||
        rec.content?.includes("resend") || rec.name?.includes("_dmarc") ||
        rec.name?.includes("send.") || rec.name?.includes("dkim");
      if (isResend) await cfApi(`/zones/${zoneId}/dns_records/${rec.id}`, { method: "DELETE" }).catch(() => {});
    }
  } catch {}
}
async function deleteFromResend(domainName: string) {
  try {
    const { env } = getCloudflareContext();
    const resendKey = (env as any).RESEND_API_KEY;
    if (!resendKey) return;
    const rh = { Authorization: `*** ${resendKey}` };
    const listRes = await fetch("https://api.resend.com/domains", { headers: rh });
    const listData: any = await listRes.json().catch(() => ({}));
    const found = (listData.data || []).find((d: any) => d.name === domainName);
    if (found) await fetch(`https://api.resend.com/domains/${found.id}`, { method: "DELETE", headers: rh });
  } catch {}
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    const { id } = await params;

    const domain: any = await db.prepare("SELECT * FROM custom_domains WHERE id = ? LIMIT 1").bind(id).first();
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    if (domain.email_rule_id && domain.zone_id) {
      await deleteEmailRule(domain.zone_id, domain.email_rule_id).catch((e) => console.warn("email rule", e?.message));
    }
    if (domain.domain && domain.domain_type !== "email_only") {
      await detachWorkerDomain(domain.domain).catch((e) => console.warn("worker detach", e?.message));
    }
    if (domain.zone_id && domain.domain) {
      await deleteResendDns(domain.zone_id, domain.domain).catch((e) => console.warn("dns", e?.message));
    }
    await deleteFromResend(domain.domain).catch((e) => console.warn("resend", e?.message));

    await db.prepare("DELETE FROM custom_domains WHERE id = ?").bind(id).run();
    await logAdminAction(admin.userId, "delete_domain", "domain", id, domain.domain);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Gagal menghapus domain" }, { status: 500 });
  }
}

// Force re-sync by calling the user sync route internally (admin override)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    const { id } = await params;

    const domain: any = await db.prepare("SELECT * FROM custom_domains WHERE id = ? LIMIT 1").bind(id).first();
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    // Import the existing sync logic by calling its route handler via fetch to same origin
    const body = await req.json().catch(() => ({}));
    const baseUrl = new URL(req.url).origin;
    const syncRes = await fetch(`${baseUrl}/api/domains/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") || "" },
      body: JSON.stringify({ domainId: id, ...body }),
    });
    const data = await syncRes.json().catch(() => ({}));
    await logAdminAction(admin.userId, "sync_domain", "domain", id, domain.domain);
    return NextResponse.json(data, { status: syncRes.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Sync failed" }, { status: 500 });
  }
}
