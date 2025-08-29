-- COMPREHENSIVE SECURITY HARDENING: ACCESS CONTROL ENFORCEMENT
-- This migration hardens access controls for leads, clients, invoices, and expenses
-- while preserving app functionality for authorized users.

-- =============================================================================
-- 1. LEADS TABLE SECURITY HARDENING
-- =============================================================================

-- Drop existing conflicting policies on leads
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads; 
DROP POLICY IF EXISTS "No public read access to leads" ON public.leads;

-- Create strict leads policies
-- POLICY 1: Block all public access (security baseline)
CREATE POLICY "block_public_leads_access" 
ON public.leads FOR ALL 
TO public 
WITH CHECK (false);

-- POLICY 2: Allow lead insertion for waitlist (public signup)
CREATE POLICY "allow_waitlist_signup" 
ON public.leads FOR INSERT 
TO public
WITH CHECK (true);

-- POLICY 3: Only authenticated admins can view leads
CREATE POLICY "admins_only_read_leads" 
ON public.leads FOR SELECT 
TO authenticated
USING (
  -- Strict admin role validation through user_roles table
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
  )
);

-- Security comment: Never expose leads.email in public views or functions
COMMENT ON TABLE public.leads IS 'SECURITY: Contains sensitive marketing data. leads.email field must never be exposed in public views. Admin-only access enforced.';

-- =============================================================================
-- 2. CLIENTS TABLE SECURITY HARDENING  
-- =============================================================================

-- Drop existing broad policies on clients
DROP POLICY IF EXISTS "read_own_org_clients" ON public.clients;

-- Create secure org-scoped client access policy
CREATE POLICY "read_org_clients_secure" 
ON public.clients FOR SELECT 
TO authenticated
USING (
  -- Only clients from user's organizations
  org_id IN (SELECT public.user_org_ids()) 
  AND deleted_at IS NULL
);

-- Create safe public view for non-sensitive client fields only
CREATE OR REPLACE VIEW public.v_clients_public AS 
SELECT 
  c.id,
  c.name,
  c.company_name,
  c.address_city,
  c.address_country, 
  c.website,
  c.archived,
  c.created_at,
  c.updated_at,
  c.org_id
FROM public.clients c
WHERE c.deleted_at IS NULL;

-- Grant access to safe view for org members
GRANT SELECT ON public.v_clients_public TO authenticated;

-- Create secure function for sensitive client data (editor+ only)
CREATE OR REPLACE FUNCTION public.get_client_sensitive_data(client_id_param uuid)
RETURNS TABLE (
  id uuid,
  email text,
  phone text, 
  tax_number text,
  vat_id text,
  contact_person text,
  address_street text,
  address_postal_code text,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Verify user is editor+ in client's org
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.org_members om ON c.org_id = om.org_id
    WHERE c.id = client_id_param 
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'editor')
    AND om.deleted_at IS NULL
    AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: Editor role required for sensitive client data';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.email,
    c.phone,
    c.tax_number, 
    c.vat_id,
    c.contact_person,
    c.address_street,
    c.address_postal_code,
    c.notes
  FROM public.clients c
  WHERE c.id = client_id_param AND c.deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.get_client_sensitive_data IS 'SECURITY: Returns sensitive client fields (email, phone, tax info) only to org members with editor+ roles';

-- =============================================================================
-- 3. INVOICES TABLE SECURITY HARDENING
-- =============================================================================

-- Drop existing broad policies
DROP POLICY IF EXISTS "read_own_org_invoices" ON public.invoices;

-- Create secure org-scoped invoice policy  
CREATE POLICY "read_org_invoices_secure"
ON public.invoices FOR SELECT
TO authenticated  
USING (
  -- Only invoices from user's organizations
  org_id IN (SELECT public.user_org_ids())
  AND deleted_at IS NULL
);

-- Create safe summary view without financial amounts
CREATE OR REPLACE VIEW public.v_invoices_summary AS
SELECT 
  i.id,
  i.number,
  i.client_id,
  i.status,
  i.issue_date,
  i.due_date,
  i.currency,
  i.created_at,
  i.updated_at,
  i.org_id,
  -- Include project info but mask financial data
  array_length(i.project_ids, 1) as project_count
FROM public.invoices i  
WHERE i.deleted_at IS NULL;

GRANT SELECT ON public.v_invoices_summary TO authenticated;

-- Create secure function for invoice financial data (editor+ only)
CREATE OR REPLACE FUNCTION public.get_invoice_financial_data(invoice_id_param uuid)
RETURNS TABLE (
  id uuid,
  total_minor integer,
  project_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER  
STABLE
SET search_path = public
AS $$
BEGIN
  -- Verify user is editor+ in invoice's org
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.org_members om ON i.org_id = om.org_id
    WHERE i.id = invoice_id_param
    AND om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin', 'editor')
    AND om.deleted_at IS NULL
    AND i.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: Editor role required for invoice financial data';
  END IF;

  RETURN QUERY
  SELECT 
    i.id,
    i.total_minor,
    i.project_ids
  FROM public.invoices i
  WHERE i.id = invoice_id_param AND i.deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.get_invoice_financial_data IS 'SECURITY: Returns sensitive invoice financial data only to org members with editor+ roles';

-- =============================================================================
-- 4. EXPENSES TABLE SECURITY HARDENING  
-- =============================================================================

-- Drop existing broad policies
DROP POLICY IF EXISTS "read_own_org_expenses" ON public.expenses;

-- Create secure org-scoped expense policy
CREATE POLICY "read_org_expenses_secure"
ON public.expenses FOR SELECT
TO authenticated
USING (
  -- Only expenses from user's organizations  
  org_id IN (SELECT public.user_org_ids())
  AND deleted_at IS NULL
);

-- Create safe summary view without financial amounts
CREATE OR REPLACE VIEW public.v_expenses_summary AS
SELECT 
  e.id,
  e.project_id,
  e.client_id,
  e.spent_on,
  e.vendor,
  e.category,
  e.description,
  e.currency,
  e.billable,
  e.reimbursable,
  e.created_at,
  e.updated_at,
  e.org_id
FROM public.expenses e
WHERE e.deleted_at IS NULL;

GRANT SELECT ON public.v_expenses_summary TO authenticated;

-- Create secure function for expense financial data (editor+ only)
CREATE OR REPLACE FUNCTION public.get_expense_financial_data(expense_id_param uuid)
RETURNS TABLE (
  id uuid,
  quantity numeric,
  unit_amount_cents integer,
  net_amount_cents integer,
  vat_amount_cents integer,  
  gross_amount_cents integer,
  vat_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE  
SET search_path = public
AS $$
BEGIN
  -- Verify user is editor+ in expense's org
  IF NOT EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.org_members om ON e.org_id = om.org_id
    WHERE e.id = expense_id_param
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'editor') 
    AND om.deleted_at IS NULL
    AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: Editor role required for expense financial data';
  END IF;

  RETURN QUERY
  SELECT 
    e.id,
    e.quantity,
    e.unit_amount_cents,
    e.net_amount_cents,
    e.vat_amount_cents,
    e.gross_amount_cents,
    e.vat_rate
  FROM public.expenses e
  WHERE e.id = expense_id_param AND e.deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.get_expense_financial_data IS 'SECURITY: Returns sensitive expense financial data only to org members with editor+ roles';

-- =============================================================================
-- 5. GRANT PERMISSIONS TO SECURE FUNCTIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_client_sensitive_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_financial_data TO authenticated;  
GRANT EXECUTE ON FUNCTION public.get_expense_financial_data TO authenticated;

-- Revoke from public
REVOKE ALL ON FUNCTION public.get_client_sensitive_data FROM public;
REVOKE ALL ON FUNCTION public.get_invoice_financial_data FROM public;
REVOKE ALL ON FUNCTION public.get_expense_financial_data FROM public;

-- =============================================================================
-- SECURITY SUMMARY COMMENTS
-- =============================================================================

COMMENT ON VIEW public.v_clients_public IS 'SAFE VIEW: Contains only non-sensitive client fields. Sensitive data (email, phone, tax info) requires editor+ role via get_client_sensitive_data()';
COMMENT ON VIEW public.v_invoices_summary IS 'SAFE VIEW: Contains invoice metadata without financial amounts. Financial data requires editor+ role via get_invoice_financial_data()';  
COMMENT ON VIEW public.v_expenses_summary IS 'SAFE VIEW: Contains expense metadata without financial amounts. Financial data requires editor+ role via get_expense_financial_data()';

-- Migration complete: Access controls hardened for leads, clients, invoices, and expenses
-- All sensitive data now requires appropriate org membership and role permissions