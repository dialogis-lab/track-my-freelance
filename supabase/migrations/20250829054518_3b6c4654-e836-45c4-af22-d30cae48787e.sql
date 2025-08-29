-- Remove the problematic view completely and use direct table access

-- 1) Drop the problematic view
DROP VIEW IF EXISTS public.v_clients_safe CASCADE;

-- 2) Instead of a view, we'll use direct table access with column selection in the frontend
-- The RLS policies on the clients table will handle security

-- 3) Create a helper function to get safe client columns (alternative approach)
CREATE OR REPLACE FUNCTION public.get_clients_safe()
RETURNS TABLE (
  id UUID,
  org_id UUID,
  name TEXT,
  company_name TEXT,
  contact_person TEXT,
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  website TEXT,
  notes TEXT,
  archived BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.org_id,
    c.name,
    c.company_name,
    c.contact_person,
    c.address_street,
    c.address_city,
    c.address_postal_code,
    c.address_country,
    c.website,
    c.notes,
    c.archived,
    c.created_at,
    c.updated_at
  FROM public.clients c
  WHERE c.deleted_at IS NULL
    AND c.org_id IN (SELECT public.user_org_ids());
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_clients_safe() TO authenticated;