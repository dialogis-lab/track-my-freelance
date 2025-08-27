-- Drop existing mfa_trusted_devices table and recreate with new structure
DROP TABLE IF EXISTS public.mfa_trusted_devices CASCADE;

-- Create the new trusted_devices table with the specified structure
CREATE TABLE public.trusted_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id VARCHAR(32) NOT NULL, -- 128-bit hex string
  ua_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of user agent
  ip_prefix INET NOT NULL, -- /24 for IPv4, /56 for IPv6
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure one device_id per user
  UNIQUE(user_id, device_id)
);

-- Enable RLS
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own trusted devices" 
ON public.trusted_devices 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_trusted_devices_user_device ON public.trusted_devices(user_id, device_id);
CREATE INDEX idx_trusted_devices_expires ON public.trusted_devices(expires_at);

-- Function to clean up expired devices
CREATE OR REPLACE FUNCTION public.cleanup_expired_trusted_devices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.trusted_devices 
  WHERE expires_at < now() OR revoked_at IS NOT NULL;
END;
$$;