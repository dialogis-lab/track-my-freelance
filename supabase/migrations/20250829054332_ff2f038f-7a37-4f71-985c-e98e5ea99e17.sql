-- ====================================
-- SECURE MULTI-TENANT ARCHITECTURE
-- ====================================

-- 1) Create organizations table if not exists
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2) Create org_members table for membership management
CREATE TABLE IF NOT EXISTS public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(org_id, user_id)
);

-- 3) Add org_id columns to existing tables
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);  
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Add missing audit columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 4) Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 5) Drop existing policies to rebuild with org-based security
DROP POLICY IF EXISTS "Authenticated users can view their own clients with security ch" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert their own clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete their own clients" ON public.clients;

DROP POLICY IF EXISTS "Users can manage their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "owner can read" ON public.expenses;
DROP POLICY IF EXISTS "owner can write" ON public.expenses;
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage their own time entries" ON public.time_entries;

-- 6) Create helper view for user's organizations
CREATE OR REPLACE VIEW public.v_my_orgs AS
SELECT org_id
FROM public.org_members
WHERE user_id = auth.uid() AND deleted_at IS NULL;

-- 7) Create role checking function
CREATE OR REPLACE FUNCTION public.is_editor(p_org UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org 
      AND user_id = auth.uid()
      AND role IN ('owner','admin','editor')
      AND deleted_at IS NULL
  );
$$;

-- 8) Create new org-based RLS policies for clients
CREATE POLICY "read_own_org_clients"
ON public.clients FOR SELECT
USING (org_id IN (SELECT org_id FROM public.v_my_orgs) AND deleted_at IS NULL);

CREATE POLICY "insert_clients_editor"
ON public.clients FOR INSERT
WITH CHECK (public.is_editor(org_id) AND created_by = auth.uid());

CREATE POLICY "update_clients_editor"
ON public.clients FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.v_my_orgs))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "delete_clients_editor"
ON public.clients FOR DELETE
USING (public.is_editor(org_id));

-- 9) Create new org-based RLS policies for invoices
CREATE POLICY "read_own_org_invoices"
ON public.invoices FOR SELECT
USING (org_id IN (SELECT org_id FROM public.v_my_orgs) AND deleted_at IS NULL);

CREATE POLICY "insert_invoices_editor"
ON public.invoices FOR INSERT
WITH CHECK (public.is_editor(org_id) AND created_by = auth.uid());

CREATE POLICY "update_invoices_editor"
ON public.invoices FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.v_my_orgs))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "delete_invoices_editor"
ON public.invoices FOR DELETE
USING (public.is_editor(org_id));

-- 10) Create new org-based RLS policies for expenses
CREATE POLICY "read_own_org_expenses"
ON public.expenses FOR SELECT
USING (org_id IN (SELECT org_id FROM public.v_my_orgs) AND deleted_at IS NULL);

CREATE POLICY "insert_expenses_editor"
ON public.expenses FOR INSERT
WITH CHECK (public.is_editor(org_id) AND created_by = auth.uid());

CREATE POLICY "update_expenses_editor"
ON public.expenses FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.v_my_orgs))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "delete_expenses_editor"
ON public.expenses FOR DELETE
USING (public.is_editor(org_id));

-- 11) Create new org-based RLS policies for projects
CREATE POLICY "read_own_org_projects"
ON public.projects FOR SELECT
USING (org_id IN (SELECT org_id FROM public.v_my_orgs) AND deleted_at IS NULL);

CREATE POLICY "insert_projects_editor"
ON public.projects FOR INSERT
WITH CHECK (public.is_editor(org_id) AND created_by = auth.uid());

CREATE POLICY "update_projects_editor"
ON public.projects FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.v_my_orgs))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "delete_projects_editor"
ON public.projects FOR DELETE
USING (public.is_editor(org_id));

-- 12) Create new org-based RLS policies for time_entries
CREATE POLICY "read_own_org_time_entries"
ON public.time_entries FOR SELECT
USING (org_id IN (SELECT org_id FROM public.v_my_orgs) AND deleted_at IS NULL);

CREATE POLICY "insert_time_entries_editor"
ON public.time_entries FOR INSERT
WITH CHECK (public.is_editor(org_id) AND created_by = auth.uid());

CREATE POLICY "update_time_entries_editor"
ON public.time_entries FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.v_my_orgs))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "delete_time_entries_editor"
ON public.time_entries FOR DELETE
USING (public.is_editor(org_id));

-- 13) Organization and membership policies
CREATE POLICY "read_own_orgs"
ON public.organizations FOR SELECT
USING (id IN (SELECT org_id FROM public.v_my_orgs) AND deleted_at IS NULL);

CREATE POLICY "insert_orgs_authenticated"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "update_orgs_owner"
ON public.organizations FOR UPDATE
USING (public.is_editor(id))
WITH CHECK (public.is_editor(id));

CREATE POLICY "read_own_memberships"
ON public.org_members FOR SELECT
USING (user_id = auth.uid() OR org_id IN (SELECT org_id FROM public.v_my_orgs WHERE org_id IN (
  SELECT om.org_id FROM public.org_members om 
  WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
)));

CREATE POLICY "insert_memberships_owner"
ON public.org_members FOR INSERT
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "update_memberships_owner"
ON public.org_members FOR UPDATE
USING (public.is_editor(org_id))
WITH CHECK (public.is_editor(org_id));

CREATE POLICY "delete_memberships_owner"
ON public.org_members FOR DELETE
USING (public.is_editor(org_id));

-- 14) Create safe view for clients without sensitive data
CREATE OR REPLACE VIEW public.v_clients_safe AS
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

-- Grant access to safe view
GRANT SELECT ON public.v_clients_safe TO anon, authenticated;

-- 15) Create RPC for accessing sensitive client data
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
      AND c.org_id IN (SELECT org_id FROM public.v_my_orgs)
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

-- Secure RPC permissions
REVOKE ALL ON FUNCTION public.get_client_sensitive(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_sensitive(UUID) TO authenticated;

-- 16) Create performance indexes
CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_org ON public.expenses(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_org ON public.time_entries(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.org_members(org_id) WHERE deleted_at IS NULL;

-- 17) Create function to get user's current organization
CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id 
  FROM public.org_members 
  WHERE user_id = auth.uid() 
    AND deleted_at IS NULL 
  ORDER BY created_at ASC 
  LIMIT 1;
$$;

-- 18) Create trigger to auto-assign org_id and created_by on inserts
CREATE OR REPLACE FUNCTION public.set_org_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set created_by if not already set
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  -- Set org_id if not already set
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.get_current_org_id();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply triggers to relevant tables
DROP TRIGGER IF EXISTS set_org_defaults_clients ON public.clients;
CREATE TRIGGER set_org_defaults_clients
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_org_defaults();

DROP TRIGGER IF EXISTS set_org_defaults_invoices ON public.invoices;
CREATE TRIGGER set_org_defaults_invoices
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_org_defaults();

DROP TRIGGER IF EXISTS set_org_defaults_expenses ON public.expenses;
CREATE TRIGGER set_org_defaults_expenses
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_org_defaults();

DROP TRIGGER IF EXISTS set_org_defaults_projects ON public.projects;
CREATE TRIGGER set_org_defaults_projects
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_org_defaults();

DROP TRIGGER IF EXISTS set_org_defaults_time_entries ON public.time_entries;
CREATE TRIGGER set_org_defaults_time_entries
  BEFORE INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_org_defaults();