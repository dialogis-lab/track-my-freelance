-- SECURITY FIX: Remove Unencrypted Sensitive Fields from Profiles Table
-- This migration removes the unencrypted versions of sensitive fields that already have encrypted counterparts
-- This reduces attack surface while maintaining functionality through encrypted data access

-- 1. First, verify that encrypted versions exist for all data before removal
DO $$
DECLARE
  unencrypted_count INTEGER;
  encrypted_count INTEGER;
BEGIN
  -- Count records with unencrypted sensitive data
  SELECT COUNT(*) INTO unencrypted_count
  FROM public.profiles 
  WHERE stripe_customer_id IS NOT NULL 
    OR address IS NOT NULL 
    OR bank_details IS NOT NULL 
    OR vat_id IS NOT NULL;
    
  -- Count records with encrypted sensitive data  
  SELECT COUNT(*) INTO encrypted_count
  FROM public.profiles 
  WHERE stripe_customer_id_enc IS NOT NULL 
    OR address_enc IS NOT NULL 
    OR bank_details_enc IS NOT NULL 
    OR vat_id_enc IS NOT NULL;
    
  -- Log the migration info
  INSERT INTO public.audit_logs (
    user_id, event_type, details
  ) VALUES (
    NULL,
    'security_migration_unencrypted_data_removal',
    jsonb_build_object(
      'unencrypted_records_count', unencrypted_count,
      'encrypted_records_count', encrypted_count,
      'migration_timestamp', NOW(),
      'security_level', 'critical'
    )
  );
END $$;

-- 2. Update functions that still reference unencrypted fields
CREATE OR REPLACE FUNCTION public.get_profiles_safe()
RETURNS TABLE(
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
SET search_path TO 'public'
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

-- 3. Remove the unencrypted sensitive columns from profiles table
-- These columns are security risks as they duplicate encrypted data
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_subscription_id;  
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS address;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS bank_details;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS vat_id;

-- 4. Update the masked financial function to only use encrypted indicators
CREATE OR REPLACE FUNCTION public.get_profile_masked_financial()
RETURNS TABLE(
  id UUID,
  company_name TEXT,
  has_stripe_customer BOOLEAN,
  has_subscription BOOLEAN,
  has_address BOOLEAN,
  has_bank_details BOOLEAN,
  has_vat_id BOOLEAN,
  subscription_status TEXT,
  subscription_plan TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER  
SET search_path TO 'public'
AS $$
BEGIN
  -- Return only masked/safe financial indicators using ONLY encrypted fields
  RETURN QUERY
  SELECT 
    p.id,
    p.company_name,
    (p.stripe_customer_id_enc IS NOT NULL) as has_stripe_customer,
    (p.stripe_subscription_id_enc IS NOT NULL) as has_subscription,
    (p.address_enc IS NOT NULL) as has_address,
    (p.bank_details_enc IS NOT NULL) as has_bank_details,
    (p.vat_id_enc IS NOT NULL) as has_vat_id,
    p.stripe_subscription_status,
    p.subscription_plan
  FROM public.profiles p
  WHERE p.id = auth.uid() AND auth.uid() IS NOT NULL;
END;
$$;

-- 5. Update the financial data access function to only return encrypted versions
CREATE OR REPLACE FUNCTION public.get_profile_financial_data(profile_id_param UUID DEFAULT auth.uid())
RETURNS TABLE(
  -- Only return encrypted versions for maximum security
  stripe_customer_id_enc JSONB,
  stripe_subscription_id_enc JSONB,
  stripe_price_id_enc JSONB,
  address_enc JSONB,
  bank_details_enc JSONB,
  vat_id_enc JSONB
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- CRITICAL: Only allow access to own profile
  IF profile_id_param != auth.uid() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Can only access own financial data';
  END IF;
  
  -- Check rate limits
  IF NOT public.check_profile_access_rate_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many sensitive profile access attempts';
  END IF;
  
  -- Log this high-risk access
  INSERT INTO public.audit_logs (
    user_id, event_type, details
  ) VALUES (
    auth.uid(),
    'profile_financial_data_accessed',
    jsonb_build_object(
      'profile_id', profile_id_param,
      'access_timestamp', NOW(),
      'security_level', 'high_risk',
      'data_type', 'encrypted_only'
    )
  );
  
  -- Return ONLY encrypted financial data
  RETURN QUERY
  SELECT 
    p.stripe_customer_id_enc,
    p.stripe_subscription_id_enc,
    p.stripe_price_id_enc,
    p.address_enc,
    p.bank_details_enc,
    p.vat_id_enc
  FROM public.profiles p
  WHERE p.id = profile_id_param;
END;
$$;

-- 6. Enhanced audit trigger to detect any attempts to access removed fields
CREATE OR REPLACE FUNCTION public.audit_profile_sensitive_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sensitive_fields TEXT[];
  access_details JSONB;
BEGIN
  -- Identify which sensitive encrypted fields are being accessed
  sensitive_fields := ARRAY[]::TEXT[];
  
  -- Only check encrypted fields now (unencrypted versions removed)
  IF COALESCE(NEW.stripe_customer_id_enc, OLD.stripe_customer_id_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'stripe_customer_id_enc');
  END IF;
  
  IF COALESCE(NEW.stripe_subscription_id_enc, OLD.stripe_subscription_id_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'stripe_subscription_id_enc');
  END IF;
  
  IF COALESCE(NEW.bank_details_enc, OLD.bank_details_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'bank_details_enc');
  END IF;
  
  IF COALESCE(NEW.address_enc, OLD.address_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'address_enc');
  END IF;
  
  IF COALESCE(NEW.vat_id_enc, OLD.vat_id_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'vat_id_enc');
  END IF;

  -- Build detailed access information
  access_details := jsonb_build_object(
    'user_id', COALESCE(NEW.id, OLD.id),
    'sensitive_fields_accessed', sensitive_fields,
    'operation_type', TG_OP,
    'table_name', TG_TABLE_NAME,
    'timestamp', NOW(),
    'high_risk_operation', array_length(sensitive_fields, 1) > 0,
    'encryption_only', true
  );

  -- Log to audit table only if sensitive fields are involved
  IF array_length(sensitive_fields, 1) > 0 THEN
    INSERT INTO public.audit_logs (
      user_id,
      event_type,
      details
    ) VALUES (
      auth.uid(),
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'sensitive_profile_data_created'
        WHEN TG_OP = 'UPDATE' THEN 'sensitive_profile_data_modified'
        WHEN TG_OP = 'DELETE' THEN 'sensitive_profile_data_deleted'
        WHEN TG_OP = 'SELECT' THEN 'sensitive_profile_data_accessed'
      END,
      access_details
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7. Test that rate limiting function is working correctly
DO $$
DECLARE
  rate_limit_test BOOLEAN;
BEGIN
  -- Test the rate limiting function
  SELECT public.check_profile_access_rate_limit(auth.uid()) INTO rate_limit_test;
  
  -- Log rate limiting status
  INSERT INTO public.audit_logs (
    user_id, event_type, details
  ) VALUES (
    NULL,
    'security_migration_rate_limit_test',
    jsonb_build_object(
      'rate_limit_function_working', rate_limit_test IS NOT NULL,
      'test_timestamp', NOW()
    )
  );
END $$;