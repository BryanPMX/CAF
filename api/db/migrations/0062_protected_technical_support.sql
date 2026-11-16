-- The historical startup/system account is ID 1 (already protected from deletion).
-- Promote only that administrative account. Keep names, email, password, active
-- state and deletion state intact; never reactivate the insecure legacy default.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version BIGINT NOT NULL DEFAULT 0;

UPDATE users
SET role = 'technical_support', office_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = 1 AND role IN ('admin', 'executive_director');

-- Bootstrap is the only provisioning flow for this singleton system role.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_technical_support
ON users(role) WHERE role = 'technical_support';
