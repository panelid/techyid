import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function updateRule(zoneId: string, domain: string, ruleId: string, destination: string) {
  const { env } = getCloudflareContext();
  const c = env as any;
  if (!c.CF_API_EMAIL || !c.CF_API_TOKEN) throw new Error("Email service unavailable");
  const payload = { name: `door custom domain ${domain}`, enabled: true, matchers: [{ type: "literal", field: "to", value: `*@${domain}` }], actions: [{ type: "forward", value: [destination] }] };
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/${encodeURIComponent(ruleId)}`, { method: "PUT", headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Email destination update failed");
}

export async function GET(request: Request) {
  const db = getDB(); 
  const user = await getSessionUser(request);
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { results } = await db.prepare("SELECT id, domain, zone_id, email_rule_id, email_destination, email_status FROM custom_domains WHERE user_id = ? AND is_verified = 1 ORDER BY domain").bind(user.userId).all();
    return NextResponse.json({ domains: results || [], email: user.email });
  } catch (error) {
    console.error("[API:email:GET] query failed", error);
    return NextResponse.json({ error: "Gagal memuat domain email" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDB(); 
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { domainId, destination } = await request.json();
    if (typeof destination !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
    const domain: any = await db.prepare("SELECT domain, zone_id, email_rule_id FROM custom_domains WHERE id = ? AND user_id = ? AND is_verified = 1 LIMIT 1").bind(domainId, user.userId).first();
    if (!domain?.email_rule_id) return NextResponse.json({ error: "Email belum aktif" }, { status: 400 });
    await updateRule(domain.zone_id, domain.domain, domain.email_rule_id, destination.trim());
    await db.prepare("UPDATE custom_domains SET email_destination = ? WHERE id = ? AND user_id = ?").bind(destination.trim(), domainId, user.userId).run();
    return NextResponse.json({ success: true, destination: destination.trim() });
  } catch (error: any) { console.error("[API:email]", error); return NextResponse.json({ error: error.message || "Gagal memperbarui email" }, { status: 500 }); }
}