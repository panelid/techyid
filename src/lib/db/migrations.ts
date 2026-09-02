// lib/db/migrations.ts
// Auto-run migrations on Worker startup

export async function runMigrations(db: any) {
  if (!db) return;
  try {
    // Migration: 0002_emails table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        domain_id TEXT,
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        subject TEXT,
        body_r2_key TEXT,
        received_at INTEGER NOT NULL,
        is_read INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `).run();
    
    console.log("[DB] Migration 0002_emails completed");
  } catch (error: any) {
    console.error("[DB] Migration failed:", error?.message);
    // Don't throw — migration may already exist
  }

  try {
    await db.prepare(`ALTER TABLE custom_domains ADD COLUMN resend_status TEXT NOT NULL DEFAULT 'pending'`).run();
    console.log("[DB] Migration 0006 resend_status completed");
  } catch { /* already exists */ }
  try {
    await db.prepare(`ALTER TABLE custom_domains ADD COLUMN resend_domain_id TEXT`).run();
    console.log("[DB] Migration 0006b resend_domain_id completed");
  } catch { /* already exists */ }

  // Migration: 0007 sent_emails + email_tracking
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
    // Add body column if missing (for sent-message detail view)
    try {
      await db.prepare(`ALTER TABLE sent_emails ADD COLUMN body TEXT`).run();
    } catch { /* already exists */ }
    console.log("[DB] Migration 0007 sent_emails completed");
  } catch (e: any) {
    console.error("[DB] Migration 0007 failed:", e?.message);
  }
}

  // Migration 0008: domain_type column for email-only subdomains
  try {
    await db.prepare(`ALTER TABLE custom_domains ADD COLUMN domain_type TEXT NOT NULL DEFAULT 'full'`).run();
    console.log("[DB] Migration 0008 domain_type completed");
  } catch { /* already exists */ }
  try {
    await db.prepare(`ALTER TABLE custom_domains ADD COLUMN parent_domain TEXT`).run();
    console.log("[DB] Migration 0008b parent_domain completed");
  } catch { /* already exists */

  // Migration: 0009 admin flag on users
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`).run();
    console.log("[DB] Migration 0009 is_admin completed");
  } catch { /* already exists */ }

  // Migration: 0010 admin tables
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
    console.log("[DB] Migration 0010 admin tables completed");
  } catch (e: any) {
    console.error("[DB] Migration 0010 failed:", e?.message);
  }
}
