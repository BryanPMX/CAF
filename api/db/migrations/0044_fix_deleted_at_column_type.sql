-- Migration: 0044_fix_deleted_at_column_type.sql
-- Description: Fix timestamp column type issues and recreate views
-- Date: 2025-01-27
-- Author: CAF System Team
-- Version: 1.0 - Migrated from legacy migrations directory

-- This migration addresses the GORM auto-migration error where it cannot alter
-- column types because they're used by views

-- Step 1: Drop views that depend on any timestamp columns in the cases table
DROP VIEW IF EXISTS active_cases;
DROP VIEW IF EXISTS deleted_cases;

-- Step 2: Alter all timestamp columns to ensure they're the correct type
-- This allows GORM to successfully alter the column types
DO $$
BEGIN
    -- Check if cases table exists before altering
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cases') THEN
        -- Alter timestamp columns with error handling
        BEGIN
            ALTER TABLE cases 
            ALTER COLUMN deleted_at TYPE timestamp USING deleted_at::timestamp,
            ALTER COLUMN completed_at TYPE timestamp USING completed_at::timestamp,
            ALTER COLUMN archived_at TYPE timestamp USING archived_at::timestamp,
            ALTER COLUMN created_at TYPE timestamp USING created_at::timestamp,
            ALTER COLUMN updated_at TYPE timestamp USING updated_at::timestamp;
            RAISE NOTICE 'Successfully updated timestamp columns in cases table';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Timestamp columns in cases table may already be correct type: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Cases table does not exist, skipping timestamp column updates';
    END IF;
END $$;

-- Step 3: Recreate the views with the updated column types
CREATE OR REPLACE VIEW active_cases AS
SELECT * FROM cases 
WHERE deleted_at IS NULL AND (is_archived = FALSE OR is_archived IS NULL);

CREATE OR REPLACE VIEW deleted_cases AS
SELECT * FROM cases 
WHERE deleted_at IS NOT NULL OR is_archived = TRUE;

-- Step 4: Add comments for documentation
COMMENT ON VIEW active_cases IS 'View showing only active (non-deleted, non-archived) cases';
COMMENT ON VIEW deleted_cases IS 'View showing only deleted or archived cases';

-- Insert audit log entry for this migration
INSERT INTO audit_logs (
    entity_type, entity_id, action, user_id, user_role,
    reason, tags, severity, created_at
) VALUES (
    'system', 0, 'migration', 1, 'admin',
    'Migrated legacy migration: Fixed timestamp column types and recreated views',
    ARRAY['migration', 'legacy_consolidation', 'schema_fix', 'views', 'timestamp_fix'], 'info', CURRENT_TIMESTAMP
);

-- Success notification (must be in DO block)
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 0044_fix_deleted_at_column_type completed successfully';
END $$;
