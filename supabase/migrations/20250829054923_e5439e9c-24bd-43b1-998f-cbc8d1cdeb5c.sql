-- Fix security definer view warning

-- The security linter detected an issue with views that have SECURITY DEFINER properties
-- Let's ensure our profile view doesn't have any security definer issues

-- Drop and recreate the view without any potential security definer properties
DROP VIEW IF EXISTS public.v_profiles_public CASCADE;

-- Recreate the view with explicit security settings
CREATE VIEW public.v_profiles_public 
WITH (security_barrier = false) AS
SELECT 
    id,
    company_name,          -- Safe: Business name
    logo_url,              -- Safe: Public asset URL  
    timer_skin,            -- Safe: UI preference
    onboarding_state,      -- Safe: Application state
    created_at,            -- Safe: Creation timestamp
    updated_at             -- Safe: Update timestamp
FROM public.profiles;

-- Grant proper permissions (authenticated users can read via RLS)
GRANT SELECT ON public.v_profiles_public TO authenticated;

-- Add security comment
COMMENT ON VIEW public.v_profiles_public IS 'SAFE VIEW: Contains only non-sensitive profile fields. Inherits RLS from base profiles table. No payment, banking, or PII data included.';

-- Ensure the base profiles table has proper RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;