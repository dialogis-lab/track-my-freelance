-- Fix security definer view issues by handling dependencies properly

-- 1) Drop all policies that depend on v_my_orgs
DROP POLICY IF EXISTS "read_own_org_clients" ON public.clients;
DROP POLICY IF EXISTS "update_clients_editor" ON public.clients;
DROP POLICY IF EXISTS "read_own_org_invoices" ON public.invoices;
DROP POLICY IF EXISTS "update_invoices_editor" ON public.invoices;
DROP POLICY IF EXISTS "read_own_org_expenses" ON public.expenses;
DROP POLICY IF EXISTS "update_expenses_editor" ON public.expenses;
DROP POLICY IF EXISTS "read_own_org_projects" ON public.projects;
DROP POLICY IF EXISTS "update_projects_editor" ON public.projects;
DROP POLICY IF EXISTS "read_own_org_time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "update_time_entries_editor" ON public.time_entries;
DROP POLICY IF EXISTS "read_own_orgs" ON public.organizations;
DROP POLICY IF EXISTS "read_own_memberships" ON public.org_members;

-- 2) Now drop and recreate the views
DROP VIEW IF EXISTS public.v_my_orgs CASCADE;
DROP VIEW IF EXISTS public.v_clients_safe CASCADE;

-- 3) Create helper function instead of view to avoid security definer issues
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM public.org_members
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
$$;

-- 4) Create safe client view without problematic constructs
CREATE VIEW public.v_clients_safe AS
SELECT 
  id, 
  org_id, 
  name, 
  company_name, 
  contact_person,
  address_street,
  address_city, 
  address_postal_code,
  address_country, 
  website,
  notes,
  archived,
  created_at,
  updated_at
FROM public.clients
WHERE deleted_at IS NULL;

-- Grant proper permissions
GRANT SELECT ON public.v_clients_safe TO authenticated;

-- 5) Recreate all RLS policies using the function instead of view
CREATE POLICY "read_own_org_clients"
ON public.clients FOR SELECT
USING (org_id IN (SELECT public.user_org_ids()) AND deleted_at IS NULL);

CREATE POLICY "update_clients_editor"
ON public.clients FOR UPDATE
USING (org_id IN (SELECT public.user_org_ids()))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "read_own_org_invoices"
ON public.invoices FOR SELECT
USING (org_id IN (SELECT public.user_org_ids()) AND deleted_at IS NULL);

CREATE POLICY "update_invoices_editor"
ON public.invoices FOR UPDATE
USING (org_id IN (SELECT public.user_org_ids()))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "read_own_org_expenses"
ON public.expenses FOR SELECT
USING (org_id IN (SELECT public.user_org_ids()) AND deleted_at IS NULL);

CREATE POLICY "update_expenses_editor"
ON public.expenses FOR UPDATE
USING (org_id IN (SELECT public.user_org_ids()))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "read_own_org_projects"
ON public.projects FOR SELECT
USING (org_id IN (SELECT public.user_org_ids()) AND deleted_at IS NULL);

CREATE POLICY "update_projects_editor"
ON public.projects FOR UPDATE
USING (org_id IN (SELECT public.user_org_ids()))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "read_own_org_time_entries"
ON public.time_entries FOR SELECT
USING (org_id IN (SELECT public.user_org_ids()) AND deleted_at IS NULL);

CREATE POLICY "update_time_entries_editor"
ON public.time_entries FOR UPDATE
USING (org_id IN (SELECT public.user_org_ids()))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "read_own_orgs"
ON public.organizations FOR SELECT
USING (id IN (SELECT public.user_org_ids()) AND deleted_at IS NULL);

CREATE POLICY "read_own_memberships"
ON public.org_members FOR SELECT
USING (user_id = auth.uid() OR org_id IN (SELECT public.user_org_ids()));

-- 6) Update the get_client_sensitive function to use the new function
CREATE OR REPLACE FUNCTION public.get_client_sensitive(p_id UUID)
RETURNS TABLE (
  email TEXT, 
  phone TEXT, 
  vat_id TEXT, 
  tax_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this client
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = p_id
      AND c.org_id IN (SELECT public.user_org_ids())
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT c.email, c.phone, c.vat_id, c.tax_number
  FROM public.clients c
  WHERE c.id = p_id AND c.deleted_at IS NULL;
END;
$$;