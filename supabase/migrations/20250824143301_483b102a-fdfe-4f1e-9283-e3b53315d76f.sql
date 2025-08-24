-- Create audit logs table for MFA security events
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs
CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only system can insert audit logs (no user insert policy)
-- This ensures logs are immutable and only created by secure functions

-- Create index for performance
CREATE INDEX idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs(event_type, created_at DESC);

-- Create trusted devices table (optional upgrade)
CREATE TABLE public.mfa_trusted_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_hash TEXT NOT NULL,
  device_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, device_hash)
);

-- Enable RLS for trusted devices
ALTER TABLE public.mfa_trusted_devices ENABLE ROW LEVEL SECURITY;

-- Users can manage their own trusted devices
CREATE POLICY "Users can manage their own trusted devices" 
ON public.mfa_trusted_devices 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for performance and cleanup
CREATE INDEX idx_trusted_devices_user ON public.mfa_trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_expires ON public.mfa_trusted_devices(expires_at);

-- Create rate limiting table for MFA attempts
CREATE TABLE public.mfa_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS for rate limits
ALTER TABLE public.mfa_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limit status
CREATE POLICY "Users can view their own rate limits" 
ON public.mfa_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only system functions can manage rate limits
-- (No insert/update/delete policies for users)

-- Create function to clean up expired trusted devices
CREATE OR REPLACE FUNCTION public.cleanup_expired_trusted_devices()
RETURNS void AS $$
BEGIN
  DELETE FROM public.mfa_trusted_devices 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reset rate limits (called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.mfa_rate_limits 
  WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;