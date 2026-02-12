-- Migration: 0054_contact_submissions_office_id.sql
-- Description: Add office_id to contact_submissions so the contact form can record which office the user selected.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_submissions' AND column_name = 'office_id') THEN
        ALTER TABLE contact_submissions ADD COLUMN office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added office_id to contact_submissions';
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_contact_submissions_office_id ON contact_submissions(office_id) WHERE office_id IS NOT NULL;
