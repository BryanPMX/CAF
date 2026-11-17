-- Retire the duplicate office-management role without changing office assignments,
-- credentials or active/deleted status. Existing sessions must sign in again.
UPDATE users
SET role = 'admin', token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
WHERE role = 'office_manager';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass AND conname='chk_users_retired_office_role') THEN
  ALTER TABLE users ADD CONSTRAINT chk_users_retired_office_role CHECK (role <> 'office_manager');
 END IF;
END $$;
DROP INDEX IF EXISTS idx_users_staff;
CREATE INDEX idx_users_staff ON users(id, first_name, last_name, role, department)
WHERE deleted_at IS NULL AND role IN ('technical_support','executive_director','admin','lawyer','psychologist','receptionist','event_coordinator');
