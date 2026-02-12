-- Migration: 0046_create_notifications_table.sql
-- Description: Notifications table schema alignment and indexes (table created in 0001_initial_schema.sql)
-- Date: 2025-01-27
-- Author: CAF System Team
-- Version: 1.0 - Legacy compatibility: add missing link, drop obsolete columns; add created_at index only.
-- Note: idx_notifications_user_id and idx_notifications_is_read already exist in 0001. FK from 0001 REFERENCES users(id).

-- Legacy: ensure link exists and drop obsolete columns (not in 0001; for DBs created before 0001 had link)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'link'
    ) THEN
        ALTER TABLE notifications ADD COLUMN link VARCHAR(500);
        RAISE NOTICE 'Added link column to notifications table';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'title'
    ) THEN
        ALTER TABLE notifications DROP COLUMN title;
        RAISE NOTICE 'Removed unused title column from notifications table';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'read_at'
    ) THEN
        ALTER TABLE notifications DROP COLUMN read_at;
        RAISE NOTICE 'Removed unused read_at column from notifications table';
    END IF;
END $$;

-- Only index not present in 0001
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Add comments for documentation (matching actual schema from 0001_initial_schema.sql)
COMMENT ON TABLE notifications IS 'Stores user notifications for the notification system';
COMMENT ON COLUMN notifications.user_id IS 'ID of the user who should receive this notification';
COMMENT ON COLUMN notifications.message IS 'The notification message in Spanish';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read by the user';
COMMENT ON COLUMN notifications.type IS 'Type of notification: info, warning, error, success';

-- Add comment for link column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'link'
    ) THEN
        EXECUTE 'COMMENT ON COLUMN notifications.link IS ''Optional URL for navigation when notification is clicked''';
        RAISE NOTICE 'Added comment for link column';
    END IF;
END $$;

-- Insert audit log entry for this migration
INSERT INTO audit_logs (
    entity_type, entity_id, action, user_id, user_role,
    reason, tags, severity, created_at
) VALUES (
    'system', 0, 'migration', 1, 'admin',
    'Migrated legacy migration: Created notifications table for notification system',
    ARRAY['migration', 'legacy_consolidation', 'notifications', 'table_creation'], 'info', CURRENT_TIMESTAMP
);

-- Success notification (must be in DO block)
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 0046_create_notifications_table completed successfully';
END $$;
