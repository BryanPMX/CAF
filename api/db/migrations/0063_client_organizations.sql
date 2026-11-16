-- Shared client records: factories, construction companies, employment history,
-- direct company appointments and related clients on internal calendar events.
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) NOT NULL DEFAULT 'person';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass AND conname='chk_user_client_type') THEN
  ALTER TABLE users ADD CONSTRAINT chk_user_client_type CHECK (client_type IN ('person','organization'));
 END IF;
END $$;

-- Company contacts need not have an email address. Preserve uniqueness for every
-- supplied email, including deleted accounts, while permitting blank company emails.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS uni_users_email;
DROP INDEX IF EXISTS idx_users_email_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_present ON users(email) WHERE email <> '';

CREATE TABLE IF NOT EXISTS organizations (
 id BIGSERIAL PRIMARY KEY,
 kind VARCHAR(20) NOT NULL CHECK (kind IN ('maquila','constructora')),
 office_id BIGINT NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
 name VARCHAR(255) NOT NULL,
 legal_representative VARCHAR(255) NOT NULL DEFAULT '',
 legal_address VARCHAR(1000) NOT NULL DEFAULT '',
 board_president VARCHAR(255) NOT NULL DEFAULT '',
 neighborhood VARCHAR(255) NOT NULL DEFAULT '',
 account_client_id BIGINT UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_name_office ON organizations(office_id,kind,LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_office ON organizations(office_id,kind);
CREATE TABLE IF NOT EXISTS organization_clients (
 id BIGSERIAL PRIMARY KEY,
 organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 employee_number VARCHAR(100) NOT NULL DEFAULT '',
 shift_name VARCHAR(100) NOT NULL DEFAULT '',
 shift_start VARCHAR(5) NOT NULL DEFAULT '',
 shift_end VARCHAR(5) NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id,client_id),
 CHECK ((shift_start='' AND shift_end='') OR (shift_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND shift_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
);
CREATE INDEX IF NOT EXISTS idx_organization_clients_client ON organization_clients(client_id);

ALTER TABLE cases ADD COLUMN IF NOT EXISTS maquila_id BIGINT REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS employee_number VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS shift_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS shift_end VARCHAR(5) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_cases_maquila ON cases(maquila_id,office_id);

ALTER TABLE appointments ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='appointments'::regclass AND conname='chk_appointment_subject') THEN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointment_subject CHECK (case_id IS NOT NULL OR client_id IS NOT NULL);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_appointments_direct_client ON appointments(client_id,office_id);
CREATE TABLE IF NOT EXISTS calendar_event_clients (
 id BIGSERIAL PRIMARY KEY,
 event_id BIGINT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
 client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 UNIQUE(event_id,client_id)
);
CREATE INDEX IF NOT EXISTS idx_calendar_event_clients_client ON calendar_event_clients(client_id);
