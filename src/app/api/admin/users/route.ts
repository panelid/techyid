import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";
import { withCache } from "@/lib/adminCache";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = 20;
    const offset = (page - 1) * limit;
    const cacheKey = `users:${q}:${page}`;

    const { users, total } = await withCache(cacheKey, 15_000, async () => {
      const likeQ = q ? `%${q}%` : "%";
      const args: any[] = q ? [likeQ, likeQ, likeQ] : [];
      const where = q ? "WHERE u.email LIKE ? OR u.username LIKE ? OR u.id LIKE ?" : "";
      const rows = await db
        .prepare(
          `SELECT u.id, u.email, u.username, u.created_at,
                  (SELECT COUNT(*) FROM slugs s WHERE s.user_id = u.id) AS link_count,
                  (SELECT COUNT(*) FROM custom_domains d WHERE d.user_id = u.id) AS domain_count,
                  (SELECT COUNT(*) FROM user_bans b WHERE b.user_id = u.id AND (b.expires_at IS NULL OR b.expires_at > datetime('now'))) AS is_banned
           FROM users u ${where}
           ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
        )
        .bind(...args, limit, offset)
        .all();
      const totalRows = await db
        .prepare(`SELECT COUNT(*) c FROM users u ${where}`)
        .bind(...args)
        .first();
      return { users: (rows.results || []) as any[], total: (totalRows as any)?.c ?? 0 };
    });

    return NextResponse.json(
      { users, total, page, limit },
      { headers: { "Cache-Control": "public, max-age=15" } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
