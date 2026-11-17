-- Share company identities without merging records or moving service history.
-- Keep the former registry/account offices for audit; appointments and individual
-- clients retain their own responsible offices and all existing references.
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_organization_office_id BIGINT;
UPDATE users SET legacy_organization_office_id = COALESCE(legacy_organization_office_id, office_id), office_id = NULL
WHERE client_type = 'organization' AND id IN (
 SELECT account_client_id FROM organizations WHERE kind = 'constructora'
);
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS chk_organization_office_kind;
UPDATE organizations SET legacy_office_id = COALESCE(legacy_office_id, office_id), office_id = NULL
WHERE kind = 'constructora' AND office_id IS NOT NULL;
ALTER TABLE organizations ADD CONSTRAINT chk_organization_office_kind
 CHECK (kind IN ('maquila', 'constructora') AND office_id IS NULL);
-- Existing duplicate names/IDs remain intact. Serialized API writes prevent new
-- duplicates within each directory, including writes from Usuarios.
CREATE INDEX IF NOT EXISTS idx_shared_organization_name
 ON organizations(kind, LOWER(TRIM(name))) WHERE deleted_at IS NULL;
