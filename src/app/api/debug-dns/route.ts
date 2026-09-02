import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { env } = getCloudflareContext();
    const c = env as any;
    const headers = { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json" };

    // Find the email_only subdomain
    const dom: any = await db.prepare("SELECT * FROM custom_domains WHERE user_id = ? AND domain_type = 'email_only' LIMIT 1").bind(user.userId).first();
    if (!dom) return NextResponse.json({ error: "No email_only domain found" }, { status: 404 });

    const out: any = { domain: dom.domain, zone_id: dom.zone_id };

    // 1. Email routing status for the zone
    const erRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${dom.zone_id}/email/routing`, { headers });
    const erBody: any = await erRes.json().catch(() => ({}));
    out.email_routing = erBody?.result?.enabled ?? erBody?.result?.status ?? erBody?.errors ?? erRes.status;

    // 2. DNS records for the subdomain (query all, filter by domain suffix)
    const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${dom.zone_id}/dns_records?per_page=500`, { headers });
    const dnsBody: any = await dnsRes.json().catch(() => ({}));
    const allRecs: any[] = dnsBody?.result || [];
    out.dns_records = allRecs
      .filter((r: any) => r.name?.endsWith(dom.domain) || r.name === dom.domain)
      .map((r: any) => ({ id: r.id, type: r.type, name: r.name, content: r.content, priority: r.priority ?? null }));
    out.dns_error = dnsBody?.errors?.map((e: any) => e.message).join("; ") || null;

    // 3. Try enabling email routing + creating MX, show errors
    const enableRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${dom.zone_id}/email/routing/enable`, { method: "POST", headers, body: "{}" });
    const enableBody: any = await enableRes.json().catch(() => ({}));
    out.enable_result = enableRes.ok ? "enabled" : (enableBody?.errors?.map((e: any) => e.message).join("; ") || `HTTP ${enableRes.status}`);

    // 4. Try creating one MX record, show raw error
    const mxRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${dom.zone_id}/dns_records`, {
      method: "POST", headers,
      body: JSON.stringify({ type: "MX", name: dom.domain, content: "route1.mx.cloudflare.net", priority: 13, ttl: 3600 }),
    });
    const mxBody: any = await mxRes.json().catch(() => ({}));
    out.mx_create = mxRes.ok ? "created" : (mxBody?.errors?.map((e: any) => e.message).join("; ") || `HTTP ${mxRes.status}`);

    // 5. Inspect Resend domain: fetch its required records, then try creating each in CF DNS
    const resendKey = (env as any).RESEND_API_KEY;
    out.resend = { key_present: Boolean(resendKey), resend_domain_id: dom.resend_domain_id || null };
    if (resendKey && dom.resend_domain_id) {
      const rr = await fetch(`https://api.resend.com/domains/${dom.resend_domain_id}`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const rd: any = await rr.json().catch(() => ({}));
      out.resend.status = rd.status || rd.domain?.status;
      out.resend.records_needed = (rd.records || []).map((r: any) => ({ record: r.record, type: r.type, name: r.name, value: (r.value||"").slice(0,40), priority: r.priority ?? null }));
      // try create each in CF DNS
      const recordBase = dom.domain_type === "email_only" && dom.parent_domain ? dom.parent_domain : dom.domain;
      out.resend.create_results = [];
      for (const rec of rd.records || []) {
        const fullName = rec.name === "@" ? dom.domain : `${rec.name}.${recordBase}`;
        const payload: any = { type: rec.type, name: fullName, content: rec.value, ttl: 3600 };
        if (rec.priority != null) payload.priority = rec.priority;
        const cr = await fetch(`https://api.cloudflare.com/client/v4/zones/${dom.zone_id}/dns_records`, {
          method: "POST", headers, body: JSON.stringify(payload),
        });
        const cb: any = await cr.json().catch(() => ({}));
        out.resend.create_results.push({
          type: rec.type, name: fullName, ok: cr.ok,
          error: cr.ok ? null : (cb?.errors?.map((e: any) => e.message).join("; ") || `HTTP ${cr.status}`),
        });
      }
    }

    return NextResponse.json(out);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}

// DELETE: remove DNS records whose name contains the double-subdomain bug
// (e.g. resend._domainkey.sobur.sobur.panel.id / send.sobur.sobur.panel.id).
// These were created by an earlier buggy sync that appended the full domain to
// Resend's already-prefixed record names.
export async function DELETE(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { env } = getCloudflareContext();
    const c = env as any;
    const headers = { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json" };

    const dom: any = await db.prepare("SELECT * FROM custom_domains WHERE user_id = ? AND domain_type = 'email_only' LIMIT 1").bind(user.userId).first();
    if (!dom) return NextResponse.json({ error: "No email_only domain found" }, { status: 404 });

    const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${dom.zone_id}/dns_records?per_page=500`, { headers });
    const dnsBody: any = await dnsRes.json().catch(() => ({}));
    const allRecs: any[] = dnsBody?.result || [];

    // Wrong records: name contains the subdomain label twice, e.g. ".sobur.sobur."
    const label = dom.domain.split(".")[0]; // "sobur"
    const wrong = allRecs.filter((r: any) => {
      const base = dom.domain; // sobur.panel.id
      const doubleSub = `${label}.${base}`; // sobur.sobur.panel.id
      return r.name?.includes(doubleSub) || r.name?.endsWith(`.${label}.${base}`);
    });

    const deleted: any[] = [];
    for (const rec of wrong) {
      const dr = await fetch(`https://api.cloudflare.com/client/v4/zones/${dom.zone_id}/dns_records/${rec.id}`, {
        method: "DELETE", headers,
      });
      deleted.push({ id: rec.id, type: rec.type, name: rec.name, deleted: dr.ok, status: dr.status });
    }

    return NextResponse.json({ deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
