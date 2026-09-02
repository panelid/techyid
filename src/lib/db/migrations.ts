// lib/db/migrations.ts
// Auto-run migrations on Worker startup. Base schema lives in schema.sql (applied once).
// This file handles incremental ALTERs / new tables.

export async function runMigrations(db: any) {
  if (!db) return;

  // 0007: sent_emails + email_tracking
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sent_emails (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        subject TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        resend_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        opened_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS email_tracking (
        id TEXT PRIMARY KEY,
        sent_email_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        FOREIGN KEY(sent_email_id) REFERENCES sent_emails(id)
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sent_emails_user ON sent_emails(user_id)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_email_tracking_token ON email_tracking(token)`).run();
    try { await db.prepare(`ALTER TABLE sent_emails ADD COLUMN body TEXT`).run(); } catch {}
  } catch (e: any) {
    console.error("[DB] Migration 0007 failed:", e?.message);
  }

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
