-- CRITICAL SECURITY FIX: Protect Sensitive Financial Data in Profiles Table
-- This migration implements comprehensive security controls for user financial data

-- 1. CREATE ENHANCED AUDIT LOGGING FOR PROFILE ACCESS
CREATE OR REPLACE FUNCTION public.audit_profile_sensitive_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  sensitive_fields TEXT[];
  access_details JSONB;
BEGIN
  -- Identify which sensitive fields are being accessed
  sensitive_fields := ARRAY[]::TEXT[];
  
  IF COALESCE(NEW.stripe_customer_id, OLD.stripe_customer_id) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'stripe_customer_id');
  END IF;
  
  IF COALESCE(NEW.stripe_subscription_id, OLD.stripe_subscription_id) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'stripe_subscription_id');
  END IF;
  
  IF COALESCE(NEW.address, OLD.address) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'address');
  END IF;
  
  IF COALESCE(NEW.bank_details, OLD.bank_details) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'bank_details');
  END IF;
  
  IF COALESCE(NEW.vat_id, OLD.vat_id) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'vat_id');
  END IF;
  
  -- Also check encrypted fields
  IF COALESCE(NEW.stripe_customer_id_enc, OLD.stripe_customer_id_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'stripe_customer_id_enc');
  END IF;
  
  IF COALESCE(NEW.bank_details_enc, OLD.bank_details_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'bank_details_enc');
  END IF;
  
  IF COALESCE(NEW.address_enc, OLD.address_enc) IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'address_enc');
  END IF;

  -- Build detailed access information
  access_details := jsonb_build_object(
    'user_id', COALESCE(NEW.id, OLD.id),
    'sensitive_fields_accessed', sensitive_fields,
    'operation_type', TG_OP,
    'table_name', TG_TABLE_NAME,
    'timestamp', NOW(),
    'high_risk_operation', array_length(sensitive_fields, 1) > 0
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

-- 2. CREATE RATE LIMITING FUNCTION FOR SENSITIVE PROFILE ACCESS
CREATE OR REPLACE FUNCTION public.check_profile_access_rate_limit(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  hourly_access_count INTEGER := 0;
  daily_access_count INTEGER := 0;
  hourly_limit INTEGER := 25;  -- Stricter limit for financial data
  daily_limit INTEGER := 100;   -- Daily limit for sensitive operations
BEGIN
  -- Check how many sensitive profile operations this user has performed
  SELECT COUNT(*) INTO hourly_access_count
  FROM public.audit_logs
  WHERE user_id = user_id_param
    AND event_type LIKE '%profile%sensitive%'
    AND created_at > NOW() - INTERVAL '1 hour';
  
  SELECT COUNT(*) INTO daily_access_count
  FROM public.audit_logs
  WHERE user_id = user_id_param
    AND event_type LIKE '%profile%sensitive%'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Check limits
  IF hourly_access_count >= hourly_limit OR daily_access_count >= daily_limit THEN
    -- Log the rate limit violation
    INSERT INTO public.audit_logs (
      user_id, event_type, details
    ) VALUES (
      user_id_param,
      'profile_access_rate_limit_exceeded',
      jsonb_build_object(
        'hourly_count', hourly_access_count,
        'daily_count', daily_access_count,
        'timestamp', NOW()
      )
    );
    
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 3. CREATE SECURE FUNCTION FOR SENSITIVE PROFILE DATA ACCESS
CREATE OR REPLACE FUNCTION public.get_profile_financial_data(profile_id_param UUID DEFAULT auth.uid())
RETURNS TABLE(
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT, 
  stripe_price_id TEXT,
  address TEXT,
  bank_details TEXT,
  vat_id TEXT,
  -- Encrypted versions
  stripe_customer_id_enc JSONB,
  stripe_subscription_id_enc JSONB,
  stripe_price_id_enc JSONB,
  address_enc JSONB,
  bank_details_enc JSONB,
  vat_id_enc JSONB
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
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
      'security_level', 'high_risk'
    )
  );
  
  -- Return financial data
  RETURN QUERY
  SELECT 
    p.stripe_customer_id,
    p.stripe_subscription_id,
    p.stripe_price_id,
    p.address,
    p.bank_details,
    p.vat_id,
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

-- 4. CREATE FUNCTION FOR MASKED PROFILE DATA (SAFE ACCESS)
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
SET search_path = 'public'
AS $$
BEGIN
  -- Return only masked/safe financial indicators
  RETURN QUERY
  SELECT 
    p.id,
    p.company_name,
    (p.stripe_customer_id IS NOT NULL OR p.stripe_customer_id_enc IS NOT NULL) as has_stripe_customer,
    (p.stripe_subscription_id IS NOT NULL OR p.stripe_subscription_id_enc IS NOT NULL) as has_subscription,
    (p.address IS NOT NULL OR p.address_enc IS NOT NULL) as has_address,
    (p.bank_details IS NOT NULL OR p.bank_details_enc IS NOT NULL) as has_bank_details,
    (p.vat_id IS NOT NULL OR p.vat_id_enc IS NOT NULL) as has_vat_id,
    p.stripe_subscription_status,
    p.subscription_plan
  FROM public.profiles p
  WHERE p.id = auth.uid() AND auth.uid() IS NOT NULL;
END;
$$;

-- 5. CREATE TRIGGER FOR COMPREHENSIVE AUDIT LOGGING
DROP TRIGGER IF EXISTS profiles_sensitive_audit_trigger ON public.profiles;
CREATE TRIGGER profiles_sensitive_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profile_sensitive_access();

-- 6. ENHANCE RLS POLICIES WITH STRICTER CONTROLS
-- Remove existing policies and create enhanced ones
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile only" ON public.profiles;

-- New enhanced policies with rate limiting
CREATE POLICY "profiles_secure_select" ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND public.check_profile_access_rate_limit(auth.uid())
);

CREATE POLICY "profiles_secure_insert" ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "profiles_secure_update" ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND public.check_profile_access_rate_limit(auth.uid())
)
WITH CHECK (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL
);

-- 7. GRANT PERMISSIONS FOR SECURE FUNCTIONS
GRANT EXECUTE ON FUNCTION public.get_profile_financial_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_masked_financial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_profile_access_rate_limit(UUID) TO authenticated;

-- 8. CREATE DATA CLEANUP FUNCTION FOR OLD AUDIT LOGS
CREATE OR REPLACE FUNCTION public.cleanup_old_profile_audit_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Keep sensitive profile audit logs for 3 years for compliance
  DELETE FROM public.audit_logs 
  WHERE event_type LIKE '%profile%sensitive%'
    AND created_at < NOW() - INTERVAL '3 years';
    
  -- Keep rate limit logs for 90 days
  DELETE FROM public.audit_logs 
  WHERE event_type = 'profile_access_rate_limit_exceeded'
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$;