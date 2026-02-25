-- Migration: 0057_users_stripe_customer_id.sql
-- Description: Add stripe_customer_id to users for secure server-side Stripe checkout/receipts integration.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
        RAISE NOTICE 'Added stripe_customer_id to users';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
