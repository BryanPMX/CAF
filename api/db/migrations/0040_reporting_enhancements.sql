-- Migration: 0040_reporting_enhancements.sql
-- Description: Reporting Enhancements (offices.code, cases.court/docket_number/fee, therapist capacities)
-- Date: 2025-01-27
-- Author: CAF System Team
-- Version: 1.0 - Migrated from legacy migrations directory

-- Offices: add short code for reporting (e.g., AZ, SF)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offices' AND column_name = 'code') THEN
        ALTER TABLE offices ADD COLUMN code VARCHAR(50);
        RAISE NOTICE 'Added code column to offices table';
    ELSE
        RAISE NOTICE 'code column already exists in offices table';
    END IF;
END $$;

-- Cases: add fields used in reports
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'court') THEN
        ALTER TABLE cases ADD COLUMN court VARCHAR(50);
        RAISE NOTICE 'Added court column to cases table';
    ELSE
        RAISE NOTICE 'court column already exists in cases table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'docket_number') THEN
        ALTER TABLE cases ADD COLUMN docket_number VARCHAR(100);
        RAISE NOTICE 'Added docket_number column to cases table';
    ELSE
        RAISE NOTICE 'docket_number column already exists in cases table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'fee') THEN
        ALTER TABLE cases ADD COLUMN fee NUMERIC(10,2) NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added fee column to cases table';
    ELSE
        RAISE NOTICE 'fee column already exists in cases table';
    END IF;
END $$;

-- Users: add last_login to support activity filters and reporting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login') THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;
        RAISE NOTICE 'Added last_login column to users table';
    ELSE
        RAISE NOTICE 'last_login column already exists in users table';
    END IF;
END $$;

-- Backfill: set last_login for existing users to a past date to avoid empty states
UPDATE users SET last_login = COALESCE(last_login, NOW() - INTERVAL '45 days');

-- Therapist + Office + Day capacities to compute free spaces in psychology weekly report
CREATE TABLE IF NOT EXISTS therapist_office_capacities (
    id BIGSERIAL PRIMARY KEY,
    staff_id BIGINT NOT NULL,
    office_id BIGINT NOT NULL,
    day_of_week INT NOT NULL, -- 1 = Monday ... 7 = Sunday
    capacity INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_capacity_staff_office_dow
ON therapist_office_capacities(staff_id, office_id, day_of_week);

-- Insert audit log entry for this migration
INSERT INTO audit_logs (
    entity_type, entity_id, action, user_id, user_role,
    reason, tags, severity, created_at
) VALUES (
    'system', 0, 'migration', 1, 'admin',
    'Migrated legacy migration: Reporting enhancements (offices.code, cases.court/docket_number/fee, therapist capacities)',
    ARRAY['migration', 'legacy_consolidation', 'reporting', 'schema_enhancement'], 'info', CURRENT_TIMESTAMP
);

-- Success notification (must be in DO block)
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 0040_reporting_enhancements completed successfully';
END $$;
