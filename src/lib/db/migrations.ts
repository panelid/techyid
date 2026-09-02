// lib/db/migrations.ts
// Auto-run migrations on Worker startup. Base schema lives in schema.sql (applied once).
// This file handles incremental ALTERs / new tables.

export async function runMigrations(db: any) {
  if (!db) return;

  // 0008: domain_type + parent_domain for email-only subdomains
  try { await db.prepare(`ALTER TABLE custom_domains ADD COLUMN domain_type TEXT NOT NULL DEFAULT 'full'`).run(); } catch {}
  try { await db.prepare(`ALTER TABLE custom_domains ADD COLUMN parent_domain TEXT`).run(); } catch {}

  // 0009: admin flag on users
  try { await db.prepare(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`).run(); } catch {}

  // 0010: admin tables (bans, audit, broadcasts)
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_bans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        reason TEXT,
        banned_by TEXT,
        banned_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        detail TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        html TEXT,
        recipient_count INTEGER DEFAULT 0,
        sent_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch (e: any) {
    console.error("[DB] Migration 0010 failed:", e?.message);
  }
}
