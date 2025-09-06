-- Migration: 0039_fix_case_events_missing_columns.sql
-- Description: Fix missing columns in case_events table that are causing runtime errors
-- Date: 2025-01-27
-- Author: CAF System Team
-- Version: 1.0 - Emergency fix for missing case_events columns

-- This migration fixes the critical runtime errors:
-- ERROR: column "visibility" of relation "case_events" does not exist
-- ERROR: column "comment_text" of relation "case_events" does not exist
-- ERROR: column "file_name" of relation "case_events" does not exist
-- ERROR: column "file_url" of relation "case_events" does not exist
-- ERROR: column "file_type" of relation "case_events" does not exist

-- Step 1: Add missing visibility column to case_events table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE case_events ADD COLUMN visibility VARCHAR(50) DEFAULT 'internal';
        RAISE NOTICE 'Added visibility column to case_events table';
    ELSE
        RAISE NOTICE 'visibility column already exists in case_events table';
    END IF;
END $$;

-- Step 2: Add missing comment_text column to case_events table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'comment_text'
    ) THEN
        ALTER TABLE case_events ADD COLUMN comment_text TEXT;
        RAISE NOTICE 'Added comment_text column to case_events table';
    ELSE
        RAISE NOTICE 'comment_text column already exists in case_events table';
    END IF;
END $$;

-- Step 3: Add missing file_name column to case_events table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'file_name'
    ) THEN
        ALTER TABLE case_events ADD COLUMN file_name VARCHAR(255);
        RAISE NOTICE 'Added file_name column to case_events table';
    ELSE
        RAISE NOTICE 'file_name column already exists in case_events table';
    END IF;
END $$;

-- Step 4: Add missing file_url column to case_events table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'file_url'
    ) THEN
        ALTER TABLE case_events ADD COLUMN file_url VARCHAR(512);
        RAISE NOTICE 'Added file_url column to case_events table';
    ELSE
        RAISE NOTICE 'file_url column already exists in case_events table';
    END IF;
END $$;

-- Step 5: Add missing file_type column to case_events table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'file_type'
    ) THEN
        ALTER TABLE case_events ADD COLUMN file_type VARCHAR(100);
        RAISE NOTICE 'Added file_type column to case_events table';
    ELSE
        RAISE NOTICE 'file_type column already exists in case_events table';
    END IF;
END $$;

-- Step 6: Create indexes for the new columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_case_events_visibility ON case_events(visibility);
CREATE INDEX IF NOT EXISTS idx_case_events_event_type ON case_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_events_file_type ON case_events(file_type);

-- Step 7: Update existing case_events to have a default visibility if they don't have one
UPDATE case_events 
SET visibility = 'internal' 
WHERE visibility IS NULL OR visibility = '';

-- Step 8: Insert audit log entry for this migration
INSERT INTO audit_logs (
    entity_type, entity_id, action, user_id, user_role,
    reason, tags, severity, created_at
) VALUES (
    'system', 0, 'migration', 1, 'admin',
    'Emergency migration: Fixed missing case_events columns (visibility, comment_text, file_name, file_url, file_type)',
    ARRAY['migration', 'emergency', 'schema_fix', 'case_events', 'column_add'], 'critical', CURRENT_TIMESTAMP
);

-- Step 9: Verify the fix
DO $$
BEGIN
    -- Check if case_events table has all required columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'visibility'
    ) THEN
        RAISE NOTICE '✓ visibility column exists in case_events table';
    ELSE
        RAISE EXCEPTION '✗ visibility column still missing from case_events table';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'comment_text'
    ) THEN
        RAISE NOTICE '✓ comment_text column exists in case_events table';
    ELSE
        RAISE EXCEPTION '✗ comment_text column still missing from case_events table';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'file_name'
    ) THEN
        RAISE NOTICE '✓ file_name column exists in case_events table';
    ELSE
        RAISE EXCEPTION '✗ file_name column still missing from case_events table';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'file_url'
    ) THEN
        RAISE NOTICE '✓ file_url column exists in case_events table';
    ELSE
        RAISE EXCEPTION '✗ file_url column still missing from case_events table';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_events' AND column_name = 'file_type'
    ) THEN
        RAISE NOTICE '✓ file_type column exists in case_events table';
    ELSE
        RAISE EXCEPTION '✗ file_type column still missing from case_events table';
    END IF;

    RAISE NOTICE '✓ All case_events columns successfully added and verified';
END $$;
