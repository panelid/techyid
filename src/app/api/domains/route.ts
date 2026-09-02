import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function cfConfig() {
  const { env } = getCloudflareContext();
  return {
    accountId: (env as any).CF_ACCOUNT_ID,
    email: (env as any).CF_API_EMAIL,
    key: (env as any).CF_API_TOKEN,
  };
}

async function cfFetch(path: string, init: RequestInit = {}) {
  const cf = cfConfig();
  if (!cf.accountId || !cf.email || !cf.key) throw new Error("Cloudflare zone configuration missing");
  return fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { "X-Auth-Email": cf.email, "X-Auth-Key": cf.key, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function getOrCreateZone(domain: string) {
  const existingResponse = await cfFetch(`/zones?name=${encodeURIComponent(domain)}`);
  const existingBody: any = await existingResponse.json();
  if (!existingResponse.ok) throw new Error("Cloudflare zone lookup failed");
  const cf = cfConfig();
  if (existingBody.result?.length) {
    const zone = existingBody.result[0];
    if (zone.account?.id !== cf.accountId) throw new Error("Domain sudah terdaftar di akun Cloudflare lain");
    return zone;
  }

  const createdResponse = await cfFetch(`/zones`, { method: "POST", body: JSON.stringify({ account: { id: cf.accountId }, name: domain, type: "full" }) });
  const createdBody: any = await createdResponse.json();
  if (!createdResponse.ok || !createdBody.result) {
    const message = createdBody.errors?.[0]?.message || "Domain sudah terdaftar di akun Cloudflare lain atau gagal dibuat";
    throw new Error(message);
  }
  if (createdBody.result.account?.id !== cf.accountId) throw new Error("Cloudflare membuat zone pada akun yang tidak sesuai");
  return createdBody.result;
}

/** Extract root domain from a subdomain: mail.sub.panel.id → panel.id */
function findRootDomain(domain: string, existingDomains: string[]): string | null {
  const labels = domain.split(".");
  // Try progressively shorter suffixes (longest match first)
  for (let i = 1; i < labels.length; i++) {
    const candidate = labels.slice(i).join(".");
    if (existingDomains.includes(candidate)) return candidate;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { domain: rawDomain, purpose } = await request.json();
    const domain = String(rawDomain || "").trim().toLowerCase().replace(/\.$/, "");
    if (!domain || !/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(domain)) return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });

    const duplicate: any = await db.prepare("SELECT id FROM custom_domains WHERE user_id = ? AND domain = ? LIMIT 1").bind(user.userId, domain).first();
    if (duplicate) return NextResponse.json({ error: "Domain sudah terdaftar" }, { status: 409 });

    const labels = domain.split(".");
    const isSubdomain = labels.length >= 3;

    // Subdomain email-only: reuse parent zone, skip zone creation
    if (isSubdomain) {
      const { results: userDomains } = await db.prepare("SELECT domain FROM custom_domains WHERE user_id = ?").bind(user.userId).all();
      const domainNames = (userDomains || []).map((d: any) => d.domain);
      const rootDomain = findRootDomain(domain, domainNames);
      if (!rootDomain) {
        return NextResponse.json({ error: `Root domain tidak ditemukan. Tambahkan ${labels.slice(-2).join(".")} dulu sebagai custom domain.` }, { status: 400 });
      }
      // Get parent's zone_id
      const parent: any = await db.prepare("SELECT zone_id, zone_status, nameservers FROM custom_domains WHERE user_id = ? AND domain = ? LIMIT 1").bind(user.userId, rootDomain).first();
      if (!parent?.zone_id) {
        return NextResponse.json({ error: `Zone ${rootDomain} belum tersedia` }, { status: 400 });
      }
      const verificationToken = `door-verify-${crypto.randomUUID().slice(0, 8)}`;
      try {
        await db.prepare(
          "INSERT INTO custom_domains (user_id, domain, domain_type, parent_domain, zone_id, zone_status, nameservers, verification_token, provision_error, worker_status, email_destination) VALUES (?, ?, 'email_only', ?, ?, ?, ?, ?, NULL, 'skipped', ?)"
        ).bind(user.userId, domain, rootDomain, parent.zone_id, parent.zone_status || "pending", parent.nameservers, verificationToken, user.email).run();
      } catch {
        // Fallback if domain_type column doesn't exist yet (migration pending)
        await db.prepare(
          "INSERT INTO custom_domains (user_id, domain, zone_id, zone_status, nameservers, verification_token, provision_error, worker_status, email_destination) VALUES (?, ?, ?, ?, ?, ?, NULL, 'skipped', ?)"
        ).bind(user.userId, domain, parent.zone_id, parent.zone_status || "pending", parent.nameservers, verificationToken, user.email).run();
      }
      const saved: any = await db.prepare("SELECT id FROM custom_domains WHERE user_id = ? AND domain = ? LIMIT 1").bind(user.userId, domain).first();
      let ns: string[] = [];
      try { ns = JSON.parse(parent.nameservers || "[]"); } catch {}
      return NextResponse.json({ success: true, domain: { id: saved?.id, domain, domain_type: "email_only", parent_domain: rootDomain, zone_id: parent.zone_id, zone_status: parent.zone_status, nameservers: ns } }, { status: 201 });
    }

    // Regular domain: create/lookup zone
    const zone: any = await getOrCreateZone(domain);
    const nameservers = JSON.stringify(zone.name_servers || []);
    const verificationToken = `door-verify-${crypto.randomUUID().slice(0, 8)}`;
    await db.prepare("INSERT INTO custom_domains (user_id, domain, zone_id, zone_status, nameservers, verification_token, provision_error) VALUES (?, ?, ?, ?, ?, ?, NULL)").bind(user.userId, domain, zone.id, zone.status || "pending", nameservers, verificationToken).run();
    const saved: any = await db.prepare("SELECT id FROM custom_domains WHERE user_id = ? AND domain = ? LIMIT 1").bind(user.userId, domain).first();

    return NextResponse.json({ success: true, domain: { id: saved?.id, domain, domain_type: "full", zone_id: zone.id, zone_status: zone.status, nameservers: zone.name_servers || [] } }, { status: 201 });
  } catch (error: any) {
    console.error("[API:domains:POST]", error);
    return NextResponse.json({ error: error?.message || "Gagal menambahkan domain" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ domains: [] });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { results } = await db.prepare("SELECT * FROM custom_domains WHERE user_id = ? ORDER BY created_at DESC").bind(user.userId).all();
    const domains = (results || []).map((d: any) => {
      let ns: string[] = [];
      try { ns = typeof d.nameservers === "string" ? JSON.parse(d.nameservers || "[]") : (d.nameservers || []); } catch {}
      return { ...d, nameservers: Array.isArray(ns) ? ns : [] };
    });
    return NextResponse.json({ domains });
  } catch (error) {
    console.error("[API:domains:GET]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
