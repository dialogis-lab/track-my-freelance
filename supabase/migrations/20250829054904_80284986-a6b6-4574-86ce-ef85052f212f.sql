-- ============================================
-- HARDEN PROFILES TABLE SECURITY
-- ============================================

-- 1) ENFORCE STRICT RLS POLICIES
-- Drop any potentially overpermissive policies (if they exist)
DROP POLICY IF EXISTS "public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are visible to everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Ensure we have strict RLS policies (recreate to be sure)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create strict RLS policies - users can only access their own profile
CREATE POLICY "Users can view own profile only"
ON public.profiles FOR SELECT
USING (auth.uid() = id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile only"
ON public.profiles FOR UPDATE
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own profile only"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- 2) ADD ENCRYPTED FIELDS FOR SENSITIVE DATA
-- Add encrypted versions of sensitive fields that don't already have them

-- Stripe customer ID (encrypted)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id_enc JSONB;

-- Stripe subscription ID (encrypted)  
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_subscription_id_enc JSONB;

-- Stripe price ID (encrypted)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_price_id_enc JSONB;

-- Company address (encrypted - contains PII)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address_enc JSONB;

-- Logo URL (keep plain - not sensitive)
-- timer_skin (keep plain - not sensitive)
-- onboarding_state (keep plain - not sensitive)

-- 3) ADD DEPRECATION COMMENTS TO SENSITIVE PLAIN FIELDS
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'DEPRECATED: Use stripe_customer_id_enc for new data. Contains sensitive payment information.';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'DEPRECATED: Use stripe_subscription_id_enc for new data. Contains sensitive subscription information.';
COMMENT ON COLUMN public.profiles.stripe_price_id IS 'DEPRECATED: Use stripe_price_id_enc for new data. Contains sensitive pricing information.';
COMMENT ON COLUMN public.profiles.address IS 'DEPRECATED: Use address_enc for new data. Contains PII - personal address information.';
COMMENT ON COLUMN public.profiles.bank_details IS 'DEPRECATED: Use bank_details_enc for new data. Contains highly sensitive banking information.';
COMMENT ON COLUMN public.profiles.vat_id IS 'DEPRECATED: Use vat_id_enc for new data. Contains sensitive tax identification.';

-- Add comments for encrypted fields
COMMENT ON COLUMN public.profiles.stripe_customer_id_enc IS 'SECURE: Encrypted Stripe customer ID. Use via secure RPC only.';
COMMENT ON COLUMN public.profiles.stripe_subscription_id_enc IS 'SECURE: Encrypted Stripe subscription ID. Use via secure RPC only.';
COMMENT ON COLUMN public.profiles.stripe_price_id_enc IS 'SECURE: Encrypted Stripe price ID. Use via secure RPC only.';
COMMENT ON COLUMN public.profiles.address_enc IS 'SECURE: Encrypted address information. Use via secure RPC only.';
COMMENT ON COLUMN public.profiles.bank_details_enc IS 'SECURE: Encrypted banking details. Use via secure RPC only.';
COMMENT ON COLUMN public.profiles.vat_id_enc IS 'SECURE: Encrypted VAT ID. Use via secure RPC only.';

-- Add comments for safe fields
COMMENT ON COLUMN public.profiles.company_name IS 'SAFE: Company name - non-sensitive business information.';
COMMENT ON COLUMN public.profiles.logo_url IS 'SAFE: Logo URL - non-sensitive public asset reference.';
COMMENT ON COLUMN public.profiles.timer_skin IS 'SAFE: UI preference - non-sensitive user setting.';
COMMENT ON COLUMN public.profiles.onboarding_state IS 'SAFE: UI state - non-sensitive application state.';

-- 4) CREATE SAFE PUBLIC VIEW WITH ONLY NON-SENSITIVE FIELDS
CREATE OR REPLACE VIEW public.v_profiles_public AS
SELECT 
    id,
    company_name,          -- Safe: Business name
    logo_url,              -- Safe: Public asset URL
    timer_skin,            -- Safe: UI preference
    onboarding_state,      -- Safe: Application state
    created_at,            -- Safe: Creation timestamp
    updated_at             -- Safe: Update timestamp
FROM public.profiles;

-- Grant access to the safe view for authenticated users
GRANT SELECT ON public.v_profiles_public TO authenticated;

-- Add comment to the view
COMMENT ON VIEW public.v_profiles_public IS 'SAFE VIEW: Contains only non-sensitive profile fields. No payment, banking, or PII data included.';

-- 5) CREATE SECURE RPC FOR ACCESSING SENSITIVE PROFILE DATA
CREATE OR REPLACE FUNCTION public.get_profile_sensitive()
RETURNS TABLE (
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT, 
    stripe_price_id TEXT,
    address TEXT,
    -- Also return encrypted versions for migration purposes
    stripe_customer_id_enc JSONB,
    stripe_subscription_id_enc JSONB,
    stripe_price_id_enc JSONB,
    address_enc JSONB,
    bank_details_enc JSONB,
    vat_id_enc JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Secure the RPC function
REVOKE ALL ON FUNCTION public.get_profile_sensitive() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_sensitive() TO authenticated;

COMMENT ON FUNCTION public.get_profile_sensitive() IS 'SECURE RPC: Returns sensitive profile data only for the authenticated user. Use this instead of direct table access for sensitive fields.';

-- 6) CREATE INDEX FOR PERFORMANCE ON ENCRYPTED FIELDS
CREATE INDEX IF NOT EXISTS idx_profiles_encrypted_fields_not_null 
ON public.profiles (id) 
WHERE stripe_customer_id_enc IS NOT NULL 
   OR stripe_subscription_id_enc IS NOT NULL 
   OR address_enc IS NOT NULL;

-- 7) SECURITY AUDIT FUNCTION
CREATE OR REPLACE FUNCTION public.audit_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log access to sensitive profile data
    IF TG_OP = 'SELECT' AND (
        OLD.stripe_customer_id IS NOT NULL OR 
        OLD.stripe_subscription_id IS NOT NULL OR
        OLD.address IS NOT NULL OR
        OLD.bank_details IS NOT NULL OR
        OLD.vat_id IS NOT NULL
    ) THEN
        INSERT INTO public.audit_logs (
            user_id,
            event_type,
            details
        ) VALUES (
            auth.uid(),
            'sensitive_profile_access',
            jsonb_build_object(
                'profile_id', OLD.id,
                'accessed_fields', ARRAY[
                    CASE WHEN OLD.stripe_customer_id IS NOT NULL THEN 'stripe_customer_id' END,
                    CASE WHEN OLD.stripe_subscription_id IS NOT NULL THEN 'stripe_subscription_id' END,
                    CASE WHEN OLD.address IS NOT NULL THEN 'address' END,
                    CASE WHEN OLD.bank_details IS NOT NULL THEN 'bank_details' END,
                    CASE WHEN OLD.vat_id IS NOT NULL THEN 'vat_id' END
                ]::text[]
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Note: Uncomment the trigger below if you want to audit all profile access
-- CREATE TRIGGER audit_profile_sensitive_access
--     AFTER SELECT ON public.profiles
--     FOR EACH ROW 
--     EXECUTE FUNCTION public.audit_profile_access();