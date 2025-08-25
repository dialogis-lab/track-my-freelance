-- Add subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'canceled', 'expired', 'past_due')),
ADD COLUMN subscription_plan TEXT DEFAULT NULL,
ADD COLUMN subscription_current_period_end TIMESTAMPTZ,
ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();

-- Add updated_at trigger to profiles if not exists
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();