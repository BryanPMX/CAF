-- Migration: 0053_notifications_entity_and_contact.sql
-- Description: Add entity metadata to notifications for rich payloads; create contact_submissions for marketing interest
-- Enables role-based notifications (admin edits/deletes) and contact form → admin notifications

-- Notifications: optional entity context and deduplication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'entity_type') THEN
        ALTER TABLE notifications ADD COLUMN entity_type VARCHAR(50);
        RAISE NOTICE 'Added entity_type to notifications';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'entity_id') THEN
        ALTER TABLE notifications ADD COLUMN entity_id BIGINT;
        RAISE NOTICE 'Added entity_id to notifications';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'dedup_key') THEN
        ALTER TABLE notifications ADD COLUMN dedup_key VARCHAR(255);
        RAISE NOTICE 'Added dedup_key to notifications';
    END IF;
END $$;
-- Index outside DO block so it is created on re-run if column exists but index was missing
CREATE INDEX IF NOT EXISTS idx_notifications_dedup_key ON notifications(dedup_key) WHERE dedup_key IS NOT NULL;

-- Contact submissions from marketing "Contacto" page (interest form)
CREATE TABLE IF NOT EXISTS contact_submissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT NOT NULL,
    source VARCHAR(50) DEFAULT 'contacto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
COMMENT ON TABLE contact_submissions IS 'Contact/interest form submissions from marketing site';
