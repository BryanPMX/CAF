-- Migration: 0055_contact_submissions_user_id.sql
-- Description: Link contact submissions to a user (client) so admins can view interest from the client profile.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_submissions' AND column_name = 'user_id') THEN
        ALTER TABLE contact_submissions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added user_id to contact_submissions';
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_contact_submissions_user_id ON contact_submissions(user_id) WHERE user_id IS NOT NULL;
