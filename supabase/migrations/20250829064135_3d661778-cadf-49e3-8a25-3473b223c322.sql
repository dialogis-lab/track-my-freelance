-- Fix security issue: prevent public users from reading leads table
-- Remove the problematic ALL policy and create specific policies

DROP POLICY IF EXISTS "block_public_leads_access" ON public.leads;

-- Ensure only admins can read leads (this policy already exists but let's be explicit)
-- The existing "admins_only_read_leads" policy is good

-- Block all SELECT access for public (unauthenticated) users
CREATE POLICY "block_public_select_leads"
ON public.leads
FOR SELECT
TO public
USING (false);

-- Keep the INSERT policy for waitlist signup (public users can still sign up)
-- The existing "allow_waitlist_signup" policy is fine

-- Block UPDATE and DELETE for public users
CREATE POLICY "block_public_modify_leads"
ON public.leads
FOR UPDATE
TO public
USING (false);

CREATE POLICY "block_public_delete_leads"  
ON public.leads
FOR DELETE
TO public
USING (false);

-- Optional: Add rate limiting comment for future implementation
COMMENT ON POLICY "allow_waitlist_signup" ON public.leads IS 'Consider adding rate limiting in application layer to prevent spam';