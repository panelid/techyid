ALTER TABLE custom_domains ADD COLUMN resend_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE custom_domains ADD COLUMN resend_domain_id TEXT;
