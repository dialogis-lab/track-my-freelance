-- Fix search path security issues for the cleanup functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_trusted_devices()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.mfa_trusted_devices 
  WHERE expires_at < now();
END;
$$;

-- Fix search path for rate limits cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.mfa_rate_limits 
  WHERE window_start < now() - interval '1 hour';
END;
$$;