-- Add click_count column to slugs table for tracking redirects
ALTER TABLE slugs ADD COLUMN click_count INTEGER DEFAULT 0;