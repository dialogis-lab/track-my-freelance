-- Add comprehensive RLS policies for mfa_rate_limits table to prevent security bypass

-- Policy to prevent users from inserting rate limit records
-- Only system/edge functions should be able to create rate limit entries
CREATE POLICY "Prevent user insertion of rate limits" 
ON public.mfa_rate_limits 
FOR INSERT 
WITH CHECK (false);

-- Policy to prevent users from updating rate limit records  
-- Only system/edge functions should be able to modify attempt counts
CREATE POLICY "Prevent user updates to rate limits" 
ON public.mfa_rate_limits 
FOR UPDATE 
USING (false);

-- Policy to prevent users from deleting rate limit records
-- Only system/edge functions should be able to clean up rate limits
CREATE POLICY "Prevent user deletion of rate limits" 
ON public.mfa_rate_limits 
FOR DELETE 
USING (false);

-- Add comment explaining the security model
COMMENT ON TABLE public.mfa_rate_limits IS 'Rate limiting table for MFA attempts. Only system functions can modify data to prevent security bypass.';

-- Also add a check constraint to ensure attempts are reasonable
ALTER TABLE public.mfa_rate_limits 
ADD CONSTRAINT reasonable_attempt_count 
CHECK (attempts >= 0 AND attempts <= 1000);