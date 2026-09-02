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
    const likeQ = q ? `%${q}%` : "%";
    const cacheKey = `domains:${q}`;

    const domains = await withCache(cacheKey, 30_000, async () =>
      (
        await db
          .prepare(
            `SELECT d.id, d.user_id, d.domain, d.is_verified, d.zone_status, d.worker_status,
                    d.email_status, d.resend_status, d.domain_type, d.created_at,
                    u.email AS owner_email
             FROM custom_domains d LEFT JOIN users u ON d.user_id = u.id
             WHERE (? = '%' OR d.domain LIKE ? OR u.email LIKE ?)
             ORDER BY d.created_at DESC LIMIT 100`
          )
          .bind(likeQ, likeQ, likeQ)
          .all()
      ).results || []
    );

    return NextResponse.json(
      { domains: domains as any[] },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
