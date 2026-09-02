import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getCFEmailRoutingEnv() {
  try {
    const { env } = getCloudflareContext();
    const token = (env as any).CF_API_TOKEN;
    const email = (env as any).CF_API_EMAIL;
    return token && email ? { token, email } : null;
  } catch { return null; }
}

async function ensureEmailRoutingForDomain(zoneId: string, domain: string, destination: string): Promise<string | null> {
  const cf = getCFEmailRoutingEnv();
  if (!cf?.token || !cf?.email) throw new Error("Cloudflare Email configuration missing");
  const base = `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`;
  const headers = { "X-Auth-Email": cf.email, "X-Auth-Key": cf.token, "Content-Type": "application/json" };
  const payload = {
    name: `techy custom domain ${domain}`,
    enabled: true,
    matchers: [{ type: "literal", field: "to", value: `*@${domain}` }],
    actions: [{ type: "forward", value: [destination] }],
  };
  const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(payload) });
  const body: any = await res.json().catch(() => ({}));
  if (res.ok) return body.result?.id || null;
  if (res.status !== 409) throw new Error(`Email forwarding setup failed (HTTP ${res.status})`);

  const list = await fetch(base, { headers });
  const rules: any[] = (await list.json().catch(() => ({}))).result || [];
  const existing = rules.find((r: any) => r.matchers?.some((m: any) => m.type === "literal" && m.field === "to" && m.value === `*@${domain}`));
  if (!existing?.id) throw new Error("Email forwarding rule conflict could not be reconciled");
  const same = JSON.stringify(existing.actions?.[0]?.value || []) === JSON.stringify([destination]);
  if (same) return existing.id;
  const updated = await fetch(`${base}/${existing.id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
  if (!updated.ok) throw new Error(`Email forwarding update failed (HTTP ${updated.status})`);
  return existing.id;
}

async function verifyNameservers(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=NS`, { headers: { Accept: "application/dns-json" } });
    if (!res.ok) return false;
    const records = (await res.json()).Answer || [];
    const nameservers = records.map((record: any) => String(record.data || "").replace(/\.$/, "").toLowerCase());
    return nameservers.length >= 2 && nameservers.every((ns: string) => ns.endsWith(".ns.cloudflare.com"));
  } catch { return false; }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });

    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { domainId } = await request.json();
    if (!domainId) return NextResponse.json({ error: "Domain ID required" }, { status: 400 });

    const domain: any = await db.prepare(
      "SELECT id, domain, zone_id, email_rule_id, verification_token, is_verified, user_id FROM custom_domains WHERE id = ? AND user_id = ? LIMIT 1"
    ).bind(domainId, user.userId).first();

    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    if (domain.is_verified) {
      return NextResponse.json({ success: true, message: "Domain already verified", domain: domain.domain });
    }

    if (!domain.zone_id) return NextResponse.json({ error: "Zone domain belum terbuat. Klik Add Domain ulang." }, { status: 400 });

    const verified = await verifyNameservers(domain.domain as string);
    if (!verified) {
      return NextResponse.json({ error: "Nameserver belum mengarah ke Cloudflare. Pastikan registrar memakai nameserver yang terdaftar di Cloudflare zone, tunggu propagasi 24-48 jam, lalu coba lagi." }, { status: 400 });
    }

    let emailRuleId: string | null = null;
    const domainUser = await db.prepare("SELECT email FROM users WHERE id = ? LIMIT 1").bind(domain.user_id).first();
    if (domainUser?.email) {
      try {
        emailRuleId = await ensureEmailRoutingForDomain(domain.zone_id, domain.domain, domainUser.email);
        if (emailRuleId) await db.prepare("UPDATE custom_domains SET email_rule_id = ?, email_destination = ?, email_status = 'active', provision_error = NULL WHERE id = ? AND user_id = ?").bind(emailRuleId, domainUser.email, domainId, user.userId).run();
      } catch (emailRoutingError: any) {
        console.error("[API:domains/verify:POST] Email Routing setup skipped:", emailRoutingError);
        await db.prepare("UPDATE custom_domains SET email_status = 'failed', provision_error = ? WHERE id = ? AND user_id = ?").bind(emailRoutingError?.message || "Email setup failed", domainId, user.userId).run();
      }
    }

    // NS verified only — full verification happens in sync after worker attach
    await db.prepare("UPDATE custom_domains SET zone_status = 'active', verified_at = CURRENT_TIMESTAMP, provision_error = NULL WHERE id = ? AND user_id = ?").bind(domainId, user.userId).run();

    return NextResponse.json({
      success: true,
      message: "Nameservers verified — klik Sync untuk aktivasi penuh (Worker + Email)",
      domain: domain.domain,
      email_routing_configured: Boolean(emailRuleId),
      email_rule_id: emailRuleId,
    });
  } catch (error: any) {
    console.error("[API:domains/verify:POST]", error);
    return NextResponse.json({ error: error?.message || "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
