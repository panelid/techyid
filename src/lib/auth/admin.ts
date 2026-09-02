// src/lib/auth/admin.ts
// Admin authorization helper for dashboard admin panel
import { getSessionFromCookies } from "./session";
import { getDB } from "@/lib/db";

export interface AdminUser {
  userId: string;
  email: string;
  username?: string;
}

export async function getAdminFromCookies(): Promise<AdminUser | null> {
  const session = await getSessionFromCookies();
  if (!session) return null;
  const db = getDB();
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT id, email, username, is_admin FROM users WHERE id = ? AND is_admin = 1 LIMIT 1")
      .bind(session.userId)
      .first();
    if (!row) return null;
    return {
      userId: (row as any).id,
      email: (row as any).email,
      username: (row as any).username,
    };
  } catch {
    return null;
  }
}

// Audit log writer — call after any admin mutation
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail?: string
): Promise<void> {
  try {
    const db = getDB();
    if (!db) return;
    await db
      .prepare(
        "INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(crypto.randomUUID(), adminId, action, targetType, targetId, detail || null)
      .run();
  } catch (e) {
    console.error("[ADMIN] audit log failed:", e);
  }
}
