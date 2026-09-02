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
    const limit = 30;
    const offset = (page - 1) * limit;
    const cacheKey = `links:${q}:${page}`;

    const { links, total } = await withCache(cacheKey, 15_000, async () => {
      const likeQ = q ? `%${q}%` : "%";
      const where = q ? "WHERE s.slug LIKE ? OR s.data LIKE ? OR u.email LIKE ?" : "";
      const args: any[] = q ? [likeQ, likeQ, likeQ] : [];
      const rows = await db
        .prepare(
          `SELECT s.id, s.slug, s.type, s.click_count, s.created_at, s.user_id, u.email AS owner_email
           FROM slugs s LEFT JOIN users u ON s.user_id = u.id
           ${where}
           ORDER BY s.click_count DESC LIMIT ? OFFSET ?`
        )
        .bind(...args, limit, offset)
        .all();
      const totalRows = await db.prepare(`SELECT COUNT(*) c FROM slugs s ${where}`).bind(...args).first();
      return { links: (rows.results || []) as any[], total: (totalRows as any)?.c ?? 0 };
    });

    return NextResponse.json(
      { links, total, page, limit },
      { headers: { "Cache-Control": "public, max-age=15" } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
