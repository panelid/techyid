import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
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

// Delete email routing rule (we created this)
async function deleteEmailRule(zoneId: string, ruleId: string) {
  const res = await cfApi(`/zones/${zoneId}/email/routing/rules/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Email rule delete failed: ${res.status}`);
}

// Detach Worker custom domain (we created this via workers/domains PUT)
async function detachWorkerDomain(domain: string) {
  const c = cf();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.CF_ACCOUNT_ID}/workers/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
    headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Worker domain detach failed: ${res.status}`);
}

// Remove DNS records we created for Resend (MX, SPF, DKIM) — tolerate missing
async function deleteResendDns(zoneId: string, domain: string) {
  try {
    const listRes = await cfApi(`/zones/${zoneId}/dns_records?per_page=100`);
    const list: any = await listRes.json().catch(() => ({}));
    const records: any[] = list.result || [];
    for (const rec of records) {
      // Only delete records that look like Resend-managed (resend / _dmarc / send or txt/spf)
      const isResend =
        rec.name === domain ||
        rec.name.endsWith(`.${domain}`) ||
        rec.content?.includes("resend") ||
        rec.name?.includes("_dmarc") ||
        rec.name?.includes("send.") ||
        rec.name?.includes("dkim");
      if (isResend) {
        await cfApi(`/zones/${zoneId}/dns_records/${rec.id}`, { method: "DELETE" }).catch(() => {});
      }
    }
  } catch {}
}

// Delete from Resend by name (domain may exist there even if resend_domain_id is null)
async function deleteFromResend(domainName: string) {
  try {
    const { env } = getCloudflareContext();
    const resendKey = (env as any).RESEND_API_KEY;
    if (!resendKey) return;
    const rh = { Authorization: `Bearer ${resendKey}` };
    const listRes = await fetch("https://api.resend.com/domains", { headers: rh });
    const listData: any = await listRes.json().catch(() => ({}));
    const found = (listData.data || []).find((d: any) => d.name === domainName);
    if (found) {
      await fetch(`https://api.resend.com/domains/${found.id}`, { method: "DELETE", headers: rh });
    }
  } catch {}
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const domain: any = await db
      .prepare("SELECT * FROM custom_domains WHERE id = ? AND user_id = ? LIMIT 1")
      .bind(id, user.userId)
      .first();
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    // We NEVER delete the Cloudflare zone (it belongs to the user, may be managed elsewhere).
    // Only remove resources Door.id created.

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

    await db.prepare("DELETE FROM custom_domains WHERE id = ? AND user_id = ?").bind(id, user.userId).run();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API:domains/[id]:DELETE]", error);
    return NextResponse.json({ error: error?.message || "Gagal menghapus domain" }, { status: 500 });
  }
}
