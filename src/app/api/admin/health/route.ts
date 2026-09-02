import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";
import { withCache } from "@/lib/adminCache";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const cached = await withCache("health:counts", 30_000, async () => {
      const count = async (sql: string): Promise<number> => ((await db.prepare(sql).first()) as any)?.c ?? 0;
      return Promise.all([
        count("SELECT COUNT(*) c FROM users"),
        count("SELECT COUNT(*) c FROM slugs"),
        count("SELECT COUNT(*) c FROM custom_domains"),
        count("SELECT COUNT(*) c FROM emails"),
        count("SELECT COUNT(*) c FROM sent_emails"),
        count("SELECT COUNT(*) c FROM email_aliases"),
        count("SELECT COUNT(*) c FROM user_bans WHERE expires_at IS NULL OR expires_at > datetime('now')"),
      ]);
    });
    const [users, links, domains, inbound, outbound, aliases, bans] = cached;

    // KV size (TECHY_SLUGS = prod namespace)
    let kvKeys = null;
    try {
      const { env } = getCloudflareContext();
      const c = env as any;
      if (c.CF_ACCOUNT_ID && c.CF_API_EMAIL && c.CF_API_TOKEN) {
        const nsId = "367138400cb041e5b500fd2517ef99ef"; // TECHY_SLUGS
        const r = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${c.CF_ACCOUNT_ID}/storage/kv/namespaces/${nsId}/keys?limit=1`,
          { headers: { "X-Auth-Email": c.CF_API_EMAIL, "X-Auth-Key": c.CF_API_TOKEN } }
        );
        const d: any = await r.json().catch(() => ({}));
        kvKeys = d.result_info?.count ?? null;
      }
    } catch {
      kvKeys = null;
    }

    return NextResponse.json({
      database: { users, links, domains, inbound, outbound, aliases, activeBans: bans },
      kv: { slugCacheKeys: kvKeys },
    }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
