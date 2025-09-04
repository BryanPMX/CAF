-- Migration: 0038_fix_missing_columns.sql
-- Description: Fix missing columns that are causing runtime errors
-- Date: 2025-01-27
-- Author: CAF System Team
-- Version: 1.0 - Emergency fix for missing columns

-- This migration fixes the critical runtime errors:
-- ERROR: column "last_login" of relation "users" does not exist
-- ERROR: column "code" of relation "offices" does not exist

-- Step 1: Add missing last_login column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
    ) THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
        RAISE NOTICE 'Added last_login column to users table';
    ELSE
        RAISE NOTICE 'last_login column already exists in users table';
    END IF;
END $$;

-- Step 2: Add missing code column to offices table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'offices' AND column_name = 'code'
    ) THEN
        ALTER TABLE offices ADD COLUMN code VARCHAR(50);
        RAISE NOTICE 'Added code column to offices table';
    ELSE
        RAISE NOTICE 'code column already exists in offices table';
    END IF;
END $$;

-- Step 3: Create indexes for the new columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_offices_code ON offices(code);

-- Step 4: Update existing offices to have a default code if they don't have one
UPDATE offices 
SET code = 'OFFICE_' || id::text 
WHERE code IS NULL OR code = '';

-- Step 5: Insert audit log entry for this migration
INSERT INTO audit_logs (
    entity_type, entity_id, action, user_id, user_role,
    reason, tags, severity, created_at
) VALUES (
    'system', 0, 'migration', 1, 'admin',
    'Emergency migration: Fixed missing last_login and code columns',
    ARRAY['migration', 'emergency', 'schema_fix', 'column_add'], 'critical', CURRENT_TIMESTAMP
);

-- Step 6: Verify the fix
DO $$
BEGIN
    -- Check if users table has last_login column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
    ) THEN
        RAISE NOTICE '✓ last_login column exists in users table';
    ELSE
        RAISE EXCEPTION '✗ last_login column still missing from users table';
    END IF;

    -- Check if offices table has code column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'offices' AND column_name = 'code'
    ) THEN
        RAISE NOTICE '✓ code column exists in offices table';
    ELSE
        RAISE EXCEPTION '✗ code column still missing from offices table';
    END IF;
END $$;
