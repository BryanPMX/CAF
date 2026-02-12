-- Migration: 0056_users_avatar_url.sql
-- Description: Add avatar_url to users for profile image (URL or stored upload).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512);
        RAISE NOTICE 'Added avatar_url to users';
    END IF;
END $$;
