-- A factory is shared across CAF offices. Preserve every organization ID,
-- membership, case reference and employment snapshot, including duplicate names.
-- Retain the former office association in a database-only audit column.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legacy_office_id BIGINT;
ALTER TABLE organizations ALTER COLUMN office_id DROP NOT NULL;
UPDATE organizations
SET legacy_office_id = COALESCE(legacy_office_id, office_id), office_id = NULL
WHERE kind = 'maquila' AND office_id IS NOT NULL;

-- Nonunique by design: legacy factories with the same name remain separate.
-- New duplicate names are rejected by serialized API catalog mutations.
CREATE INDEX IF NOT EXISTS idx_maquila_name_global
 ON organizations(LOWER(TRIM(name))) WHERE kind='maquila' AND deleted_at IS NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='organizations'::regclass AND conname='chk_organization_office_kind') THEN
  ALTER TABLE organizations ADD CONSTRAINT chk_organization_office_kind CHECK (
   (kind='maquila' AND office_id IS NULL) OR (kind='constructora' AND office_id IS NOT NULL)
  );
 END IF;
END $$;
