import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies, logAdminAction } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action; // "ban" | "unban"

    if (action === "ban") {
      const reason = body.reason || "Violation";
      // Remove existing active ban first
      await db.prepare("DELETE FROM user_bans WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))").bind(id).run();
      await db
        .prepare("INSERT INTO user_bans (id, user_id, reason, banned_by) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, reason, admin.userId)
        .run();
      await logAdminAction(admin.userId, "ban_user", "user", id, reason);
      return NextResponse.json({ success: true, banned: true });
    }
    if (action === "unban") {
      await db.prepare("DELETE FROM user_bans WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))").bind(id).run();
      await logAdminAction(admin.userId, "unban_user", "user", id, null);
      return NextResponse.json({ success: true, banned: false });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    const { id } = await params;

    // Prevent self-delete
    if (id === admin.userId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }
    // Prevent deleting other admins
    const target: any = await db.prepare("SELECT is_admin FROM users WHERE id = ?").bind(id).first();
    if (target?.is_admin) {
      return NextResponse.json({ error: "Cannot delete another admin" }, { status: 400 });
    }

    await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    await logAdminAction(admin.userId, "delete_user", "user", id, null);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
