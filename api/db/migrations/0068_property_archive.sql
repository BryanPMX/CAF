-- Archive real property without creating legal cases or inferring ownership.
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organization_clients ADD COLUMN IF NOT EXISTS relationship_roles TEXT NOT NULL DEFAULT '[]';
ALTER TABLE organization_clients ADD COLUMN IF NOT EXISTS relationship_notes VARCHAR(2000) NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS properties (
 id BIGSERIAL PRIMARY KEY,
 office_id BIGINT NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
 organization_id BIGINT REFERENCES organizations(id) ON DELETE RESTRICT,
 parent_id BIGINT REFERENCES properties(id) ON DELETE RESTRICT,
 name VARCHAR(255) NOT NULL,
 kind VARCHAR(20) NOT NULL CHECK (kind IN ('land','block','lot')),
 development_name VARCHAR(255) NOT NULL DEFAULT '',
 address VARCHAR(1000) NOT NULL DEFAULT '',
 state VARCHAR(100) NOT NULL DEFAULT '',
 municipality VARCHAR(100) NOT NULL DEFAULT '',
 district VARCHAR(100) NOT NULL DEFAULT '',
 block VARCHAR(100) NOT NULL DEFAULT '',
 lot VARCHAR(100) NOT NULL DEFAULT '',
 cadastral_key VARCHAR(100) NOT NULL DEFAULT '',
 area_m2 NUMERIC(18,4) CHECK (area_m2 > 0),
 notes TEXT NOT NULL DEFAULT '',
 created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 updated_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TIMESTAMPTZ,
 CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS idx_properties_office ON properties(office_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_organization ON properties(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_parent ON properties(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_cadastral ON properties(cadastral_key) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS property_owners (
 id BIGSERIAL PRIMARY KEY,
 property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
 client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 share_percent NUMERIC(7,4) CHECK (share_percent > 0 AND share_percent <= 100),
 status VARCHAR(20) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','current','historical')),
 start_date DATE,
 end_date DATE,
 source VARCHAR(2000) NOT NULL DEFAULT '',
 created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 updated_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
 CHECK (status <> 'current' OR end_date IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_property_owners_property ON property_owners(property_id);
CREATE INDEX IF NOT EXISTS idx_property_owners_client ON property_owners(client_id,property_id);
CREATE TABLE IF NOT EXISTS property_registry_entries (
 id BIGSERIAL PRIMARY KEY,
 property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
 real_folio VARCHAR(100) NOT NULL DEFAULT '',
 inscription VARCHAR(100) NOT NULL DEFAULT '',
 folio VARCHAR(100) NOT NULL DEFAULT '',
 book VARCHAR(100) NOT NULL DEFAULT '',
 section VARCHAR(100) NOT NULL DEFAULT '',
 act_type VARCHAR(255) NOT NULL DEFAULT '',
 instrument_number VARCHAR(100) NOT NULL DEFAULT '',
 instrument_date DATE,
 registration_date DATE,
 notary VARCHAR(255) NOT NULL DEFAULT '',
 source VARCHAR(2000) NOT NULL DEFAULT '',
 created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 updated_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_property_registry_property ON property_registry_entries(property_id);
CREATE INDEX IF NOT EXISTS idx_property_registry_real_folio ON property_registry_entries(real_folio);
CREATE INDEX IF NOT EXISTS idx_property_registry_legacy ON property_registry_entries(inscription,folio,book);
CREATE TABLE IF NOT EXISTS property_documents (
 id BIGSERIAL PRIMARY KEY,
 property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
 file_name VARCHAR(255) NOT NULL,
 file_url VARCHAR(1000) NOT NULL,
 file_type VARCHAR(100) NOT NULL,
 created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_property_documents_property ON property_documents(property_id);
