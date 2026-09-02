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

async function api(path: string, init: RequestInit = {}) {
  const c = cf();
  return fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function ensureEmailRouting(zoneId: string, domain: string, destination: string): Promise<string | null> {
  const c = cf();
  const base = `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`;
  const headers = { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json" };
  const payload = { name: `techy ${domain}`, enabled: true, matchers: [{ type: "literal", field: "to", value: `*@${domain}` }], actions: [{ type: "forward", value: [destination] }] };
  const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(payload) });
  const body: any = await res.json().catch(() => ({}));
  if (res.ok) return body.result?.id || null;
  if (res.status !== 409) throw new Error(`Email setup failed (${res.status})`);
  const list = await fetch(base, { headers });
  const rules: any[] = (await list.json().catch(() => ({}))).result || [];
  const existing = rules.find((r: any) => r.matchers?.some((m: any) => m.type === "literal" && m.field === "to" && m.value === `*@${domain}`));
  if (!existing?.id) throw new Error("Email rule conflict unreconcilable");
  const same = JSON.stringify(existing.actions?.[0]?.value || []) === JSON.stringify([destination]);
  if (same) return existing.id;
  const updated = await fetch(`${base}/${existing.id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
  if (!updated.ok) throw new Error(`Email update failed (${updated.status})`);
  return existing.id;
}

// Ensure MX records for the domain exist (required for CF Email Routing subdomain)
// Standard CF Email Routing MX records:
//   route1.mx.cloudflare.net (priority 13)
//   route2.mx.cloudflare.net (priority 43)
//   route3.mx.cloudflare.net (priority 83)
async function ensureSubdomainMx(zoneId: string, domain: string) {
  const c = cf();
  const headers = { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json" };
  const mxRecords = [
    { type: "MX", name: domain, content: "route1.mx.cloudflare.net", priority: 13, ttl: 3600 },
    { type: "MX", name: domain, content: "route2.mx.cloudflare.net", priority: 43, ttl: 3600 },
    { type: "MX", name: domain, content: "route3.mx.cloudflare.net", priority: 83, ttl: 3600 },
  ];
  const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=MX&name=${encodeURIComponent(domain)}&per_page=100`, { headers });
  const listBody: any = await listRes.json().catch(() => ({}));
  const existingMx = (listBody.result || []).map((r: any) => r.content?.toLowerCase());
  for (const mx of mxRecords) {
    if (existingMx.some((e: string) => e.includes(mx.content))) continue;
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: "POST", headers, body: JSON.stringify(mx),
    }).catch(() => {});
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { domainId, action } = await request.json();
    const domain: any = await db.prepare("SELECT * FROM custom_domains WHERE id = ? AND user_id = ? LIMIT 1").bind(domainId, user.userId).first();
    if (!domain?.zone_id) return NextResponse.json({ error: "Zone domain belum tersedia" }, { status: 400 });

    // Action: remove domain from Resend only (free up slot)
    if (action === "delete_resend") {
      const { env } = getCloudflareContext();
      const resendKey = (env as any).RESEND_API_KEY;
      if (resendKey) {
        const rh = { Authorization: `Bearer ${resendKey}` };
        // If we have resend_domain_id, delete directly; otherwise find by name
        let delId = domain.resend_domain_id;
        if (!delId) {
          const listRes = await fetch("https://api.resend.com/domains", { headers: rh });
          const listData: any = await listRes.json().catch(() => ({}));
          const found = (listData.data || []).find((d: any) => d.name === domain.domain);
          if (found) delId = found.id;
        }
        if (delId) {
          await fetch(`https://api.resend.com/domains/${delId}`, { method: "DELETE", headers: rh });
        }
      }
      await db.prepare("UPDATE custom_domains SET resend_status = 'pending', resend_domain_id = NULL, provision_error = NULL WHERE id = ? AND user_id = ?").bind(domainId, user.userId).run();
      return NextResponse.json({ success: true, message: "Domain dihapus dari Resend. Slot tersedia untuk domain baru." });
    }

    // 1. Sync zone status
    const zoneRes = await api(`/zones/${domain.zone_id}`);
    const zoneBody: any = await zoneRes.json();
    if (!zoneRes.ok || !zoneBody.result) throw new Error(zoneBody.errors?.[0]?.message || "Gagal membaca status zone");
    const zone = zoneBody.result;
    const nameservers = JSON.stringify(zone.name_servers || JSON.parse(domain.nameservers || "[]"));
    await db.prepare("UPDATE custom_domains SET zone_status = ?, nameservers = ?, provision_error = NULL WHERE id = ? AND user_id = ?").bind(zone.status, nameservers, domain.id, user.userId).run();

    if (zone.status !== "active") {
      return NextResponse.json({ success: true, zone_status: zone.status, worker_status: domain.worker_status, email_status: domain.email_status, nameservers: JSON.parse(nameservers) });
    }

    // 2. Provision Worker custom domain (skip for email-only subdomains)
    let workerStatus = domain.worker_status;
    let workerRouteId = domain.worker_route_id;
    if (domain.domain_type === "email_only") {
      workerStatus = "skipped";
    } else {
    const c = cf();
    const wdRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.CF_ACCOUNT_ID}/workers/domains`, {
      method: "PUT",
      headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ hostname: domain.domain, service: "techy-id", environment: "production" }),
    });
    const wdBody: any = await wdRes.json().catch(() => ({}));
    if (!wdRes.ok || !wdBody.success) {
      const msg = wdBody.errors?.[0]?.message;
      throw new Error(msg || `Gagal attach domain ke Worker (${wdRes.status})`);
    }
    workerStatus = "active";
    await db.prepare("UPDATE custom_domains SET worker_status = ?, worker_route_id = ? WHERE id = ? AND user_id = ?").bind(workerStatus, workerRouteId, domain.id, user.userId).run();
    } // end else (worker domain)

    // 3. Provision Email Routing (only if not already done)
    let emailStatus = domain.email_status || "pending";
    let emailDestination = domain.email_destination;
    // For email_only subdomains, default destination to user's email if unset
    if (!emailDestination) emailDestination = user.email;
    if (emailStatus !== "active" && emailDestination) {
      try {
        // Enable Email Routing on the zone first (needed for subdomain MX to work)
        try {
          const c = cf();
          await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.zone_id}/email/routing/enable`, {
            method: "POST",
            headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json" },
            body: "{}",
          }).catch(() => {});
        } catch {}
        const ruleId = await ensureEmailRouting(domain.zone_id, domain.domain, emailDestination);
        // Ensure MX records exist (for subdomains this is required)
        await ensureSubdomainMx(domain.zone_id, domain.domain).catch(() => {});
        if (ruleId) {
          emailStatus = "active";
          await db.prepare("UPDATE custom_domains SET email_rule_id = ?, email_destination = ?, email_status = 'active', provision_error = NULL WHERE id = ? AND user_id = ?").bind(ruleId, emailDestination, domain.id, user.userId).run();
        }
      } catch (emailError: any) {
        emailStatus = "failed";
        await db.prepare("UPDATE custom_domains SET email_status = 'failed', provision_error = ? WHERE id = ? AND user_id = ?").bind(emailError?.message || "Email setup failed", domain.id, user.userId).run();
      }
    }

    // 4. Resend: create domain + install its DNS records + verify (auto email-sending)
    let resendStatus = domain.resend_status || "pending";
    let fromAddress: string | null = null;
    try {
      const { env } = getCloudflareContext();
      const resendKey = (env as any).RESEND_API_KEY;
      if (!resendKey) throw new Error("RESEND_API_KEY missing");
      const rh = { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" };

      // find or create the domain in Resend
      let rDomainId = domain.resend_domain_id as string | null;
      const listRes = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${resendKey}` } });
      const listData: any = await listRes.json().catch(() => ({}));
      const existingRD = (listData.data || []).find((d: any) => d.name === domain.domain);
      if (!rDomainId && existingRD) rDomainId = existingRD.id;
      if (!rDomainId) {
        const createRes = await fetch("https://api.resend.com/domains", {
          method: "POST", headers: rh, body: JSON.stringify({ name: domain.domain, region: "ap-northeast-1" }),
        });
        const createData: any = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error(createData.message || "Gagal buat domain di Resend");
        rDomainId = createData.id;
      }

      // install DNS records Resend expects (skip ones already present)
      const recsRes = await fetch(`https://api.resend.com/domains/${rDomainId}`, { headers: { Authorization: `Bearer ${resendKey}` } });
      const recsData: any = await recsRes.json().catch(() => ({}));
      // For subdomains, Resend's record names already include the subdomain label
      // (e.g. "resend._domainkey.sobur" for sobur.panel.id), so append the parent
      // domain only. For root domains, append the full domain.
      const recordBase = domain.domain_type === "email_only" && domain.parent_domain
        ? domain.parent_domain
        : domain.domain;
      for (const rec of recsData.records || []) {
        const name = rec.name === "@" ? domain.domain : `${rec.name}.${recordBase}`;
        const check = await api(`/zones/${domain.zone_id}/dns_records?type=${rec.type}&name=${encodeURIComponent(name)}&per_page=1`);
        const checkBody: any = await check.json().catch(() => ({}));
        if ((checkBody.result || []).length > 0) continue;
        const payload: any = { type: rec.type, name, content: rec.value, ttl: 3600 };
        if (rec.priority != null) payload.priority = rec.priority;
        // Tolerate conflicts (e.g. MX already used by another provider) — they don't block sending verification.
        try {
          await api(`/zones/${domain.zone_id}/dns_records`, { method: "POST", body: JSON.stringify(payload) });
        } catch (e: any) {
          console.warn(`[sync] skip DNS ${rec.type} ${name}: ${e?.message || "conflict"}`);
        }
      }

      // Check current status first — only re-verify if not already verified
      // (re-verifying resets Resend's status to pending temporarily)
      let resendVerified = false;
      const preStatusRes = await fetch(`https://api.resend.com/domains/${rDomainId}`, { headers: { Authorization: `Bearer ${resendKey}` } });
      const preStatusData: any = await preStatusRes.json().catch(() => ({}));
      const preStatus = preStatusData.domain?.status || preStatusData.status || "pending";
      if (preStatus === "verified") {
        resendVerified = true;
      } else {
        // verify + poll status (Resend may need a few seconds to reflect verification)
        await fetch(`https://api.resend.com/domains/${rDomainId}/verify`, { method: "POST", headers: rh, body: "{}" });
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise((r) => setTimeout(r, 4000)); // 4s x 10 = up to 40s
          const statusRes = await fetch(`https://api.resend.com/domains/${rDomainId}`, { headers: { Authorization: `Bearer ${resendKey}` } });
          const statusData: any = await statusRes.json().catch(() => ({}));
          if (statusData.domain?.status === "verified" || statusData.status === "verified") {
            resendVerified = true;
            break;
          }
        }
      }
      resendStatus = resendVerified ? "verified" : "pending";
      fromAddress = `noreply@${domain.domain}`;
      await db.prepare("UPDATE custom_domains SET resend_status = ?, resend_domain_id = ?, provision_error = NULL WHERE id = ? AND user_id = ?").bind(resendStatus, rDomainId, domain.id, user.userId).run();
    } catch (resendError: any) {
      resendStatus = "failed";
      await db.prepare("UPDATE custom_domains SET resend_status = 'failed', provision_error = ? WHERE id = ? AND user_id = ?").bind(resendError?.message || "Resend setup failed", domain.id, user.userId).run();
    }

    // 5. Mark verified.
    // - Full domain: verified when worker is active.
    // - Email-only subdomain: verified when email routing is active (worker intentionally skipped).
    // JANGAN reset provision_error jika langkah Resend gagal (biarkan pesan error tetap terbaca di UI).
    const isVerified = domain.domain_type === "email_only" ? emailStatus === "active" : workerStatus === "active";
    if (resendStatus === "failed") {
      await db.prepare("UPDATE custom_domains SET is_verified = ?, verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?").bind(isVerified ? 1 : 0, domain.id, user.userId).run();
    } else {
      await db.prepare("UPDATE custom_domains SET is_verified = ?, verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP), provision_error = NULL WHERE id = ? AND user_id = ?").bind(isVerified ? 1 : 0, domain.id, user.userId).run();
    }

    return NextResponse.json({ success: true, zone_status: "active", worker_status: workerStatus, worker_route_id: workerRouteId, email_status: emailStatus, resend_status: resendStatus, from_address: fromAddress, nameservers: JSON.parse(nameservers) });
  } catch (error: any) {
    console.error("[API:domains:sync]", error);
    return NextResponse.json({ error: error?.message || "Provisioning domain gagal" }, { status: 500 });
  }
}
