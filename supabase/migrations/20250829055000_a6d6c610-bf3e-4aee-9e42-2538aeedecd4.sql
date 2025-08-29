-- Replace problematic view with secure function approach

-- Drop the view that might be causing security issues
DROP VIEW IF EXISTS public.v_profiles_public CASCADE;

-- Create a secure function instead of a view for safe profile access
CREATE OR REPLACE FUNCTION public.get_profiles_safe()
RETURNS TABLE (
    id UUID,
    company_name TEXT,
    logo_url TEXT,
    timer_skin TEXT,
    onboarding_state JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY INVOKER  -- Use SECURITY INVOKER instead of DEFINER
SET search_path = public
AS $$
    SELECT 
        p.id,
        p.company_name,          -- Safe: Business name
        p.logo_url,              -- Safe: Public asset URL
        p.timer_skin,            -- Safe: UI preference
        p.onboarding_state,      -- Safe: Application state
        p.created_at,            -- Safe: Creation timestamp
        p.updated_at             -- Safe: Update timestamp
    FROM public.profiles p
    WHERE p.id = auth.uid()      -- Only return current user's safe data
      AND auth.uid() IS NOT NULL;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profiles_safe() TO authenticated;
REVOKE ALL ON FUNCTION public.get_profiles_safe() FROM PUBLIC;

-- Add security comment
COMMENT ON FUNCTION public.get_profiles_safe() IS 'SAFE FUNCTION: Returns only non-sensitive profile fields for the authenticated user. No payment, banking, or PII data included.';

-- Also update the sensitive profile function to use SECURITY INVOKER where possible
-- But keep SECURITY DEFINER for this one since it needs to bypass RLS for encryption
CREATE OR REPLACE FUNCTION public.get_profile_sensitive()
RETURNS TABLE (
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT, 
    stripe_price_id TEXT,
    address TEXT,
    stripe_customer_id_enc JSONB,
    stripe_subscription_id_enc JSONB,
    stripe_price_id_enc JSONB,
    address_enc JSONB,
    bank_details_enc JSONB,
    vat_id_enc JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Keep SECURITY DEFINER for sensitive data access
STABLE
SET search_path = public
AS $$
BEGIN
    -- Only return sensitive data for the authenticated user's own profile
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to access sensitive profile data';
    END IF;

    RETURN QUERY
    SELECT 
        p.stripe_customer_id,
        p.stripe_subscription_id,
        p.stripe_price_id,
        p.address,
        p.stripe_customer_id_enc,
        p.stripe_subscription_id_enc,
        p.stripe_price_id_enc,
        p.address_enc,
        p.bank_details_enc,
        p.vat_id_enc
    FROM public.profiles p
    WHERE p.id = auth.uid();
END;
$$;