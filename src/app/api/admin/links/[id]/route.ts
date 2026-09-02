import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies, logAdminAction } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    const { id } = await params;

    const link: any = await db.prepare("SELECT slug, user_id FROM slugs WHERE id = ?").bind(id).first();
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.prepare("DELETE FROM slugs WHERE id = ?").bind(id).run();
    await logAdminAction(admin.userId, "delete_link", "link", id, `slug=${link.slug}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
