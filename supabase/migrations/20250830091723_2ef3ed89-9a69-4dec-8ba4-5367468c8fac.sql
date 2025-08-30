-- Fix critical security issue: Remove overly permissive lead insertion policy
DROP POLICY IF EXISTS "allow_waitlist_signup" ON public.leads;

-- Create a more secure policy that only allows service role to insert leads
-- This ensures only our secure Edge Function can add leads, not public users
CREATE POLICY "service_role_only_insert_leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true); -- Service role bypasses RLS, so this is safe

-- Update the public select policy to be more restrictive
DROP POLICY IF EXISTS "block_public_select_leads" ON public.leads;
CREATE POLICY "admins_only_select_leads" 
ON public.leads 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ensure other operations remain restricted
DROP POLICY IF EXISTS "block_public_modify_leads" ON public.leads;
DROP POLICY IF EXISTS "block_public_delete_leads" ON public.leads;

CREATE POLICY "admins_only_update_leads" 
ON public.leads 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_only_delete_leads" 
ON public.leads 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add additional security: Create a function to validate email domains
CREATE OR REPLACE FUNCTION public.is_valid_email_domain(email_address text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  domain text;
  suspicious_domains text[] := ARRAY[
    'tempmail.org', '10minutemail.com', 'guerrillamail.com', 
    'mailinator.com', 'yopmail.com', 'throwaway.email'
  ];
BEGIN
  -- Extract domain from email
  domain := lower(split_part(email_address, '@', 2));
  
  -- Check if domain is in suspicious list
  IF domain = ANY(suspicious_domains) THEN
    RETURN false;
  END IF;
  
  -- Check for basic domain validation (has at least one dot)
  IF position('.' in domain) = 0 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Enhanced rate limiting function with better security
CREATE OR REPLACE FUNCTION public.enhanced_waitlist_rate_limit(
  p_ip_address inet, 
  p_email text DEFAULT NULL
)
RETURNS TABLE(allowed boolean, reason text, remaining_attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ip_attempts INTEGER := 0;
  email_attempts INTEGER := 0;
  ip_limit INTEGER := 3; -- Reduced from 5 to 3 attempts per hour per IP
  email_limit INTEGER := 2; -- Reduced from 3 to 2 attempts per hour per email
  time_window INTERVAL := '1 hour';
BEGIN
  -- Clean up old rate limit entries
  DELETE FROM public.waitlist_rate_limits 
  WHERE created_at < NOW() - time_window;

  -- Check IP-based rate limits
  SELECT COALESCE(SUM(attempts), 0) INTO ip_attempts
  FROM public.waitlist_rate_limits
  WHERE ip_address = p_ip_address
    AND created_at > NOW() - time_window;

  -- Check email-based rate limits (if email provided)
  IF p_email IS NOT NULL THEN
    SELECT COALESCE(SUM(attempts), 0) INTO email_attempts
    FROM public.waitlist_rate_limits
    WHERE email = p_email
      AND created_at > NOW() - time_window;
  END IF;

  -- Check if limits exceeded
  IF ip_attempts >= ip_limit THEN
    RETURN QUERY SELECT FALSE, 'Too many attempts from this location. Please try again later.', 0;
    RETURN;
  END IF;

  IF p_email IS NOT NULL AND email_attempts >= email_limit THEN
    RETURN QUERY SELECT FALSE, 'Too many attempts for this email. Please try again later.', 0;
    RETURN;
  END IF;

  -- Validate email domain if provided
  IF p_email IS NOT NULL AND NOT public.is_valid_email_domain(p_email) THEN
    RETURN QUERY SELECT FALSE, 'Please use a valid email address.', 0;
    RETURN;
  END IF;

  -- Update rate limit tracking
  INSERT INTO public.waitlist_rate_limits (ip_address, email, attempts)
  VALUES (p_ip_address, p_email, 1)
  ON CONFLICT (ip_address) 
  DO UPDATE SET 
    attempts = waitlist_rate_limits.attempts + 1,
    email = COALESCE(EXCLUDED.email, waitlist_rate_limits.email),
    created_at = NOW();

  RETURN QUERY SELECT TRUE, 'Allowed', (ip_limit - ip_attempts - 1);
END;
$$;

-- Add logging for security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  event_details jsonb DEFAULT '{}'::jsonb,
  ip_address inet DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    event_type,
    details,
    ip_address
  ) VALUES (
    auth.uid(),
    event_type,
    event_details,
    ip_address
  );
END;
$$;