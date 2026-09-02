CREATE TABLE IF NOT EXISTS email_aliases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  local_part TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  UNIQUE(user_id, local_part, domain)
);
