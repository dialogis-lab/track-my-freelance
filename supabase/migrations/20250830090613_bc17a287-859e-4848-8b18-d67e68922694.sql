-- Fix security warnings by setting search_path for functions

-- Fix check_waitlist_rate_limit function
CREATE OR REPLACE FUNCTION public.check_waitlist_rate_limit(
  p_ip_address INET,
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE(allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ip_attempts INTEGER := 0;
  email_attempts INTEGER := 0;
  ip_limit INTEGER := 5; -- 5 attempts per hour per IP
  email_limit INTEGER := 3; -- 3 attempts per hour per email
BEGIN
  -- Clean up old rate limit entries (older than 1 hour)
  DELETE FROM public.waitlist_rate_limits 
  WHERE window_start < NOW() - INTERVAL '1 hour';

  -- Check IP-based rate limits
  SELECT COALESCE(SUM(attempts), 0) INTO ip_attempts
  FROM public.waitlist_rate_limits
  WHERE ip_address = p_ip_address
    AND window_start > NOW() - INTERVAL '1 hour';

  -- Check email-based rate limits (if email provided)
  IF p_email IS NOT NULL THEN
    SELECT COALESCE(SUM(attempts), 0) INTO email_attempts
    FROM public.waitlist_rate_limits
    WHERE email = p_email
      AND window_start > NOW() - INTERVAL '1 hour';
  END IF;

  -- Check if limits exceeded
  IF ip_attempts >= ip_limit THEN
    RETURN QUERY SELECT FALSE, 'Too many attempts from this IP address. Please try again later.';
    RETURN;
  END IF;

  IF p_email IS NOT NULL AND email_attempts >= email_limit THEN
    RETURN QUERY SELECT FALSE, 'Too many attempts for this email. Please try again later.';
    RETURN;
  END IF;

  -- Update rate limit tracking
  INSERT INTO public.waitlist_rate_limits (ip_address, email, attempts)
  VALUES (p_ip_address, p_email, 1)
  ON CONFLICT (ip_address) 
  DO UPDATE SET 
    attempts = waitlist_rate_limits.attempts + 1,
    email = COALESCE(EXCLUDED.email, waitlist_rate_limits.email);

  RETURN QUERY SELECT TRUE, 'Allowed';
END;
$$;

-- Fix check_account_lockout function
CREATE OR REPLACE FUNCTION public.check_account_lockout(p_email TEXT)
RETURNS TABLE(locked BOOLEAN, reason TEXT, attempts INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  lockout_record RECORD;
  max_attempts INTEGER := 5; -- Lock after 5 failed attempts
  lockout_duration INTERVAL := '30 minutes';
BEGIN
  SELECT * INTO lockout_record
  FROM public.account_lockouts
  WHERE email = p_email;

  -- No lockout record exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No lockout', 0;
    RETURN;
  END IF;

  -- Check if lockout period has expired
  IF lockout_record.locked_until IS NOT NULL AND lockout_record.locked_until < NOW() THEN
    -- Reset the lockout
    UPDATE public.account_lockouts
    SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE email = p_email;
    
    RETURN QUERY SELECT FALSE, 'Lockout expired', 0;
    RETURN;
  END IF;

  -- Check if account is currently locked
  IF lockout_record.locked_until IS NOT NULL AND lockout_record.locked_until > NOW() THEN
    RETURN QUERY SELECT TRUE, 
      'Account temporarily locked due to too many failed login attempts. Try again in ' || 
      EXTRACT(MINUTES FROM (lockout_record.locked_until - NOW()))::INTEGER || ' minutes.',
      lockout_record.failed_attempts;
    RETURN;
  END IF;

  -- Account not locked
  RETURN QUERY SELECT FALSE, 'Not locked', lockout_record.failed_attempts;
END;
$$;

-- Fix record_login_attempt function
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_ip_address INET,
  p_success BOOLEAN,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  lockout_record RECORD;
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '30 minutes';
BEGIN
  -- Record the login attempt
  INSERT INTO public.login_attempts (email, ip_address, success, user_agent, error_message)
  VALUES (p_email, p_ip_address, p_success, p_user_agent, p_error_message);

  -- Handle failed login attempts
  IF NOT p_success THEN
    -- Get or create lockout record
    SELECT * INTO lockout_record
    FROM public.account_lockouts
    WHERE email = p_email;

    IF NOT FOUND THEN
      -- Create new lockout record
      INSERT INTO public.account_lockouts (email, failed_attempts)
      VALUES (p_email, 1);
    ELSE
      -- Update existing lockout record
      UPDATE public.account_lockouts
      SET 
        failed_attempts = failed_attempts + 1,
        updated_at = NOW(),
        locked_until = CASE
          WHEN failed_attempts + 1 >= max_attempts THEN NOW() + lockout_duration
          ELSE locked_until
        END
      WHERE email = p_email;
    END IF;
  ELSE
    -- Successful login - reset failed attempts
    UPDATE public.account_lockouts
    SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE email = p_email;
  END IF;
END;
$$;

-- Fix cleanup_security_logs function
CREATE OR REPLACE FUNCTION public.cleanup_security_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Clean up old rate limit entries (older than 24 hours)
  DELETE FROM public.waitlist_rate_limits 
  WHERE created_at < NOW() - INTERVAL '24 hours';

  -- Clean up old login attempts (older than 30 days)
  DELETE FROM public.login_attempts 
  WHERE attempt_time < NOW() - INTERVAL '30 days';

  -- Clean up expired lockouts (older than 7 days)
  DELETE FROM public.account_lockouts 
  WHERE updated_at < NOW() - INTERVAL '7 days'
    AND (locked_until IS NULL OR locked_until < NOW() - INTERVAL '1 day');
END;
$$;