-- Add phone (required in app) and personal address (optional) to users
-- Existing rows get NULL for new columns; app enforces phone on create/update

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS personal_address TEXT;

COMMENT ON COLUMN users.phone IS 'User phone number (required on create/update in app)';
COMMENT ON COLUMN users.personal_address IS 'User personal address (optional)';

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
