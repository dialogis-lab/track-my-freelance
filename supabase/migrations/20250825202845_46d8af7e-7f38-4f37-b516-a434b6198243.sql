-- Add subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'canceled', 'expired', 'past_due')),
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;