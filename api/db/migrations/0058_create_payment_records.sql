-- Migration: 0058_create_payment_records.sql
-- Description: Persist Stripe webhook payment lifecycle data for dashboards/reports and reconciliation.

CREATE TABLE IF NOT EXISTS payment_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL,
    case_id BIGINT NULL,
    stripe_event_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL DEFAULT 'stripe.checkout.session',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50),
    source VARCHAR(100) NOT NULL DEFAULT 'stripe_checkout',
    currency VARCHAR(16),
    amount_cents BIGINT NOT NULL DEFAULT 0,
    refunded_cents BIGINT NOT NULL DEFAULT 0,
    receipt_url VARCHAR(1000),
    checkout_url VARCHAR(1000),
    live_mode BOOLEAN NOT NULL DEFAULT FALSE,
    client_metadata JSONB,
    raw_object JSONB,
    paid_at TIMESTAMP NULL,
    refunded_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_payment_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_records_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_records_checkout_session_id
    ON payment_records(stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_case_id ON payment_records(case_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_paid_at ON payment_records(paid_at);
CREATE INDEX IF NOT EXISTS idx_payment_records_event_type ON payment_records(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_records_stripe_payment_intent_id ON payment_records(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_stripe_charge_id ON payment_records(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_stripe_customer_id ON payment_records(stripe_customer_id);
