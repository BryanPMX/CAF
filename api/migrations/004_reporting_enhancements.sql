-- Migration: Reporting Enhancements (offices.code, cases.court/docket_number/fee, therapist capacities)

-- Offices: add short code for reporting (e.g., AZ, SF)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offices' AND column_name = 'code') THEN
        ALTER TABLE offices ADD COLUMN code VARCHAR(50);
    END IF;
END $$;

-- Cases: add fields used in reports
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'court') THEN
        ALTER TABLE cases ADD COLUMN court VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'docket_number') THEN
        ALTER TABLE cases ADD COLUMN docket_number VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'fee') THEN
        ALTER TABLE cases ADD COLUMN fee NUMERIC(10,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Users: add last_login to support activity filters and reporting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login') THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;
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


