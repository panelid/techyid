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
);
