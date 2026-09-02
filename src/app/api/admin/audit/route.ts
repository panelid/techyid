import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const rows = await db
      .prepare(
        `SELECT a.id, a.admin_id, a.action, a.target_type, a.target_id, a.detail, a.created_at, u.email AS admin_email
         FROM admin_audit_log a LEFT JOIN users u ON a.admin_id = u.id
         ORDER BY a.created_at DESC LIMIT 50`
      )
      .all();
    return NextResponse.json({ log: (rows.results || []) as any[] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
