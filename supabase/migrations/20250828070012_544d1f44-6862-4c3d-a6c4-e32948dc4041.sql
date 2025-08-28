-- Fix security linter warnings by setting search_path for all new functions

-- 1. Fix audit_sensitive_client_access function
CREATE OR REPLACE FUNCTION public.audit_sensitive_client_access()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log access to sensitive client information
  INSERT INTO public.audit_logs (
    user_id,
    event_type,
    ip_address,
    user_agent,
    details
  ) VALUES (
    auth.uid(),
    CASE 
      WHEN TG_OP = 'SELECT' THEN 'client_data_viewed'
      WHEN TG_OP = 'INSERT' THEN 'client_created'
      WHEN TG_OP = 'UPDATE' THEN 'client_updated'
      WHEN TG_OP = 'DELETE' THEN 'client_deleted'
    END,
    COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', 
             current_setting('request.headers', true)::json->>'x-real-ip')::inet,
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'client_id', COALESCE(NEW.id, OLD.id),
      'client_name', COALESCE(NEW.name, OLD.name),
      'has_sensitive_data', CASE 
        WHEN COALESCE(NEW.tax_number, OLD.tax_number) IS NOT NULL 
          OR COALESCE(NEW.vat_id, OLD.vat_id) IS NOT NULL 
          OR COALESCE(NEW.email, OLD.email) IS NOT NULL 
        THEN true 
        ELSE false 
      END,
      'operation', TG_OP
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Fix check_client_access_rate_limit function
CREATE OR REPLACE FUNCTION public.check_client_access_rate_limit(user_id_param UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  access_count INTEGER;
BEGIN
  -- Check how many client records this user has accessed in the last hour
  SELECT COUNT(*) INTO access_count
  FROM public.audit_logs
  WHERE user_id = user_id_param
    AND event_type IN ('client_data_viewed', 'client_created', 'client_updated')
    AND created_at > NOW() - INTERVAL '1 hour'
    AND (details->>'has_sensitive_data')::boolean = true;
  
  -- Allow up to 100 sensitive client data operations per hour per user
  RETURN access_count < 100;
END;
$$;

-- 3. Fix get_client_with_masked_sensitive_data function
CREATE OR REPLACE FUNCTION public.get_client_with_masked_sensitive_data(client_id_param UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  company_name TEXT,
  contact_person TEXT,
  email_masked TEXT,
  phone_masked TEXT,
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  tax_number_masked TEXT,
  vat_id_masked TEXT,
  website TEXT,
  notes TEXT,
  archived BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data if user owns this client
  IF NOT EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = client_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.company_name,
    c.contact_person,
    -- Mask email: show first 2 chars and domain
    CASE 
      WHEN c.email IS NOT NULL THEN 
        LEFT(c.email, 2) || '***@' || SPLIT_PART(c.email, '@', 2)
      ELSE NULL 
    END as email_masked,
    -- Mask phone: show last 4 digits
    CASE 
      WHEN c.phone IS NOT NULL THEN 
        '***-***-' || RIGHT(c.phone, 4)
      ELSE NULL 
    END as phone_masked,
    c.address_street,
    c.address_city,
    c.address_postal_code,
    c.address_country,
    -- Mask tax numbers: show first and last 2 chars
    CASE 
      WHEN c.tax_number IS NOT NULL AND LENGTH(c.tax_number) > 4 THEN 
        LEFT(c.tax_number, 2) || '***' || RIGHT(c.tax_number, 2)
      WHEN c.tax_number IS NOT NULL THEN '***'
      ELSE NULL 
    END as tax_number_masked,
    CASE 
      WHEN c.vat_id IS NOT NULL AND LENGTH(c.vat_id) > 4 THEN 
        LEFT(c.vat_id, 2) || '***' || RIGHT(c.vat_id, 2)
      WHEN c.vat_id IS NOT NULL THEN '***'
      ELSE NULL 
    END as vat_id_masked,
    c.website,
    c.notes,
    c.archived,
    c.created_at,
    c.updated_at
  FROM public.clients c
  WHERE c.id = client_id_param AND c.user_id = auth.uid();
END;
$$;

-- 4. Fix secure_delete_client_data function
CREATE OR REPLACE FUNCTION public.secure_delete_client_data(client_id_param UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_record RECORD;
BEGIN
  -- Check if user owns this client
  SELECT * INTO client_record 
  FROM public.clients 
  WHERE id = client_id_param AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found or access denied';
  END IF;
  
  -- Log the secure deletion
  INSERT INTO public.audit_logs (
    user_id, event_type, details
  ) VALUES (
    auth.uid(),
    'client_secure_deletion',
    jsonb_build_object(
      'client_id', client_id_param,
      'client_name', client_record.name,
      'deletion_timestamp', NOW(),
      'sensitive_data_present', (
        client_record.tax_number IS NOT NULL OR 
        client_record.vat_id IS NOT NULL OR 
        client_record.email IS NOT NULL
      )
    )
  );
  
  -- Securely delete the client record
  DELETE FROM public.clients WHERE id = client_id_param AND user_id = auth.uid();
  
  RETURN true;
END;
$$;

-- 5. Fix cleanup_old_client_audit_logs function
CREATE OR REPLACE FUNCTION public.cleanup_old_client_audit_logs()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Keep audit logs for client operations for 1 year, then delete
  DELETE FROM public.audit_logs 
  WHERE event_type IN ('client_data_viewed', 'client_created', 'client_updated', 'client_deleted')
    AND created_at < NOW() - INTERVAL '1 year';
END;
$$;