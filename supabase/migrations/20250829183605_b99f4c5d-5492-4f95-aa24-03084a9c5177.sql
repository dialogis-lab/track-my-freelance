-- Comprehensive Security Enhancement for Clients Table
-- This migration addresses critical security vulnerabilities in customer financial data handling

-- 1. CREATE ENHANCED AUDIT LOGGING FOR SENSITIVE DATA ACCESS
-- More detailed audit trail for compliance and security monitoring
CREATE OR REPLACE FUNCTION public.audit_sensitive_client_access_enhanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  client_record RECORD;
  sensitive_fields TEXT[];
  access_details JSONB;
BEGIN
  -- Get the client record being accessed
  client_record := COALESCE(NEW, OLD);
  
  -- Identify which sensitive fields are being accessed
  sensitive_fields := ARRAY[]::TEXT[];
  
  IF client_record.email IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'email');
  END IF;
  
  IF client_record.phone IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'phone');
  END IF;
  
  IF client_record.tax_number IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'tax_number');
  END IF;
  
  IF client_record.vat_id IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'vat_id');
  END IF;

  -- Build detailed access information
  access_details := jsonb_build_object(
    'client_id', client_record.id,
    'client_name', client_record.name,
    'sensitive_fields_accessed', sensitive_fields,
    'operation_type', TG_OP,
    'table_name', TG_TABLE_NAME,
    'user_org_id', client_record.org_id,
    'timestamp', NOW(),
    'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for',
    'user_agent', current_setting('request.headers', true)::json->>'user-agent',
    'session_id', current_setting('request.jwt.claims', true)::json->>'session_id'
  );

  -- Log to audit table with enhanced details
  INSERT INTO public.audit_logs (
    user_id,
    event_type,
    ip_address,
    user_agent,
    details
  ) VALUES (
    auth.uid(),
    CASE 
      WHEN TG_OP = 'SELECT' THEN 'sensitive_client_data_accessed'
      WHEN TG_OP = 'INSERT' THEN 'sensitive_client_data_created'
      WHEN TG_OP = 'UPDATE' THEN 'sensitive_client_data_modified'
      WHEN TG_OP = 'DELETE' THEN 'sensitive_client_data_deleted'
    END,
    COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', 
             current_setting('request.headers', true)::json->>'x-real-ip')::inet,
    current_setting('request.headers', true)::json->>'user-agent',
    access_details
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. CREATE COMPREHENSIVE DATA MASKING FUNCTION
-- Provides different levels of data masking based on user role and access level
CREATE OR REPLACE FUNCTION public.get_client_data_with_security_level(
  client_id_param UUID,
  security_level TEXT DEFAULT 'basic' -- 'basic', 'masked', 'full'
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  company_name TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  tax_number TEXT,
  vat_id TEXT,
  website TEXT,
  notes TEXT,
  archived BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  security_level_applied TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  client_record RECORD;
  user_role TEXT;
  is_editor BOOLEAN;
BEGIN
  -- Verify user has access to this client
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.org_members om ON c.org_id = om.org_id
    WHERE c.id = client_id_param 
    AND om.user_id = auth.uid()
    AND om.deleted_at IS NULL
    AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: No permission to view this client data';
  END IF;

  -- Check if user is editor/admin
  is_editor := public.is_editor((SELECT org_id FROM public.clients WHERE id = client_id_param));
  
  -- Get the client record
  SELECT * INTO client_record 
  FROM public.clients c
  WHERE c.id = client_id_param AND c.deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Apply security level based on user permissions and requested level
  IF security_level = 'full' AND NOT is_editor THEN
    security_level := 'masked'; -- Downgrade if user doesn't have editor permissions
  END IF;

  -- Log this access attempt
  INSERT INTO public.audit_logs (
    user_id, event_type, details
  ) VALUES (
    auth.uid(),
    'client_data_security_access',
    jsonb_build_object(
      'client_id', client_id_param,
      'requested_security_level', security_level,
      'applied_security_level', security_level,
      'user_is_editor', is_editor,
      'access_timestamp', NOW()
    )
  );

  -- Return data based on security level
  RETURN QUERY
  SELECT 
    client_record.id,
    client_record.name,
    client_record.company_name,
    client_record.contact_person,
    -- Apply email masking
    CASE 
      WHEN security_level = 'full' THEN client_record.email
      WHEN security_level = 'masked' AND client_record.email IS NOT NULL THEN 
        LEFT(client_record.email, 2) || '***@' || SPLIT_PART(client_record.email, '@', 2)
      ELSE NULL 
    END as email,
    -- Apply phone masking
    CASE 
      WHEN security_level = 'full' THEN client_record.phone
      WHEN security_level = 'masked' AND client_record.phone IS NOT NULL THEN 
        '***-***-' || RIGHT(client_record.phone, 4)
      ELSE NULL 
    END as phone,
    client_record.address_street,
    client_record.address_city,
    client_record.address_postal_code,
    client_record.address_country,
    -- Apply tax number masking
    CASE 
      WHEN security_level = 'full' THEN client_record.tax_number
      WHEN security_level = 'masked' AND client_record.tax_number IS NOT NULL AND LENGTH(client_record.tax_number) > 4 THEN 
        LEFT(client_record.tax_number, 2) || '***' || RIGHT(client_record.tax_number, 2)
      WHEN security_level = 'masked' AND client_record.tax_number IS NOT NULL THEN '***'
      ELSE NULL 
    END as tax_number,
    -- Apply VAT ID masking
    CASE 
      WHEN security_level = 'full' THEN client_record.vat_id
      WHEN security_level = 'masked' AND client_record.vat_id IS NOT NULL AND LENGTH(client_record.vat_id) > 4 THEN 
        LEFT(client_record.vat_id, 2) || '***' || RIGHT(client_record.vat_id, 2)
      WHEN security_level = 'masked' AND client_record.vat_id IS NOT NULL THEN '***'
      ELSE NULL 
    END as vat_id,
    client_record.website,
    -- Mask notes if they contain sensitive information
    CASE 
      WHEN security_level = 'full' THEN client_record.notes
      WHEN security_level = 'masked' THEN '[MASKED - Contains sensitive information]'
      ELSE NULL 
    END as notes,
    client_record.archived,
    client_record.created_at,
    client_record.updated_at,
    security_level as security_level_applied;
END;
$function$;

-- 3. ENHANCED RATE LIMITING FOR SENSITIVE CLIENT DATA ACCESS
CREATE OR REPLACE FUNCTION public.check_client_access_rate_limit_enhanced(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  hourly_access_count INTEGER;
  daily_access_count INTEGER;
  user_role_record RECORD;
  hourly_limit INTEGER := 50;  -- Default limit
  daily_limit INTEGER := 200;  -- Default limit
BEGIN
  -- Get user role to determine appropriate limits
  SELECT role INTO user_role_record 
  FROM public.user_roles 
  WHERE user_id = user_id_param 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Adjust limits based on user role
  IF user_role_record.role = 'admin' THEN
    hourly_limit := 200;
    daily_limit := 1000;
  ELSIF user_role_record.role = 'user' THEN
    hourly_limit := 25;
    daily_limit := 100;
  END IF;

  -- Check hourly access count
  SELECT COUNT(*) INTO hourly_access_count
  FROM public.audit_logs
  WHERE user_id = user_id_param
    AND event_type LIKE '%client%sensitive%'
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Check daily access count
  SELECT COUNT(*) INTO daily_access_count
  FROM public.audit_logs
  WHERE user_id = user_id_param
    AND event_type LIKE '%client%sensitive%'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Return false if limits exceeded
  IF hourly_access_count >= hourly_limit OR daily_access_count >= daily_limit THEN
    -- Log the rate limit violation
    INSERT INTO public.audit_logs (
      user_id, event_type, details
    ) VALUES (
      user_id_param,
      'client_access_rate_limit_exceeded',
      jsonb_build_object(
        'hourly_count', hourly_access_count,
        'hourly_limit', hourly_limit,
        'daily_count', daily_access_count,
        'daily_limit', daily_limit,
        'violation_timestamp', NOW()
      )
    );
    
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;

-- 4. CREATE TRIGGER FOR ENHANCED AUDIT LOGGING
-- Apply the enhanced audit logging to the clients table
DROP TRIGGER IF EXISTS clients_sensitive_audit_trigger ON public.clients;
CREATE TRIGGER clients_sensitive_audit_trigger
  AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_sensitive_client_access_enhanced();

-- 5. CREATE ADDITIONAL RLS POLICY FOR RATE LIMITING
-- Add rate limiting check to existing policies
CREATE POLICY "clients_rate_limited_access" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (
  public.check_client_access_rate_limit_enhanced(auth.uid()) AND
  (org_id IN (SELECT public.user_org_ids())) AND 
  (deleted_at IS NULL)
);

-- 6. CREATE SECURE CLIENT EXPORT FUNCTION
-- For exporting client data with proper security controls
CREATE OR REPLACE FUNCTION public.export_client_data_secure(
  client_ids UUID[] DEFAULT NULL,
  include_sensitive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  client_data JSONB,
  export_timestamp TIMESTAMP WITH TIME ZONE,
  security_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  is_editor BOOLEAN;
  export_record JSONB;
  client_record RECORD;
BEGIN
  -- Verify user has appropriate permissions
  SELECT bool_or(public.is_editor(org_id)) INTO is_editor
  FROM public.clients 
  WHERE (client_ids IS NULL OR id = ANY(client_ids))
    AND org_id IN (SELECT public.user_org_ids())
    AND deleted_at IS NULL;
  
  IF NOT is_editor THEN
    RAISE EXCEPTION 'Access denied: Editor role required for client data export';
  END IF;
  
  -- Check rate limits for export operations
  IF NOT public.check_client_access_rate_limit_enhanced(auth.uid()) THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many client data access attempts';
  END IF;
  
  -- Log the export attempt
  INSERT INTO public.audit_logs (
    user_id, event_type, details
  ) VALUES (
    auth.uid(),
    'client_data_export_attempt',
    jsonb_build_object(
      'client_ids_count', COALESCE(array_length(client_ids, 1), 0),
      'include_sensitive', include_sensitive,
      'export_timestamp', NOW()
    )
  );
  
  -- Export client data with appropriate security level
  FOR client_record IN 
    SELECT * FROM public.clients 
    WHERE (client_ids IS NULL OR id = ANY(client_ids))
      AND org_id IN (SELECT public.user_org_ids())
      AND deleted_at IS NULL
  LOOP
    SELECT row_to_json(r) INTO export_record
    FROM (
      SELECT 
        c.id,
        c.name,
        c.company_name,
        c.contact_person,
        CASE WHEN include_sensitive THEN c.email ELSE 'REDACTED' END as email,
        CASE WHEN include_sensitive THEN c.phone ELSE 'REDACTED' END as phone,
        c.address_street,
        c.address_city,
        c.address_postal_code,
        c.address_country,
        CASE WHEN include_sensitive THEN c.tax_number ELSE 'REDACTED' END as tax_number,
        CASE WHEN include_sensitive THEN c.vat_id ELSE 'REDACTED' END as vat_id,
        c.website,
        CASE WHEN include_sensitive THEN c.notes ELSE 'REDACTED' END as notes,
        c.archived,
        c.created_at,
        c.updated_at
      FROM public.clients c
      WHERE c.id = client_record.id
    ) r;
    
    RETURN QUERY
    SELECT 
      export_record as client_data,
      NOW() as export_timestamp,
      CASE WHEN include_sensitive THEN 'full' ELSE 'redacted' END as security_level;
  END LOOP;
END;
$function$;

-- 7. CREATE CLEANUP FUNCTION FOR OLD AUDIT LOGS
-- Automatic cleanup of old audit logs to prevent database bloat
CREATE OR REPLACE FUNCTION public.cleanup_old_sensitive_audit_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Keep sensitive client audit logs for 2 years for compliance
  DELETE FROM public.audit_logs 
  WHERE event_type LIKE '%client%sensitive%'
    AND created_at < NOW() - INTERVAL '2 years';
    
  -- Keep rate limit logs for 30 days
  DELETE FROM public.audit_logs 
  WHERE event_type = 'client_access_rate_limit_exceeded'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$function$;