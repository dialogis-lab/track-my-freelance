-- Add Stripe-related fields to profiles table (idempotent)
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;