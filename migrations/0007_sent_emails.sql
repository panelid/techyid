-- Outbound email tracking
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
);

CREATE TABLE IF NOT EXISTS email_tracking (
  id TEXT PRIMARY KEY,
  sent_email_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  FOREIGN KEY(sent_email_id) REFERENCES sent_emails(id)
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_user ON sent_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_token ON email_tracking(token);
