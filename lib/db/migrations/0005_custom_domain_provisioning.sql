ALTER TABLE custom_domains ADD COLUMN zone_id TEXT;
ALTER TABLE custom_domains ADD COLUMN zone_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE custom_domains ADD COLUMN nameservers TEXT;
ALTER TABLE custom_domains ADD COLUMN worker_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE custom_domains ADD COLUMN worker_route_id TEXT;
ALTER TABLE custom_domains ADD COLUMN email_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE custom_domains ADD COLUMN email_destination_id TEXT;
ALTER TABLE custom_domains ADD COLUMN provision_error TEXT;
ALTER TABLE custom_domains ADD COLUMN updated_at_v2 DATETIME;

CREATE INDEX IF NOT EXISTS idx_custom_domains_zone ON custom_domains(zone_id);