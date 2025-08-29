-- FIX SECURITY DEFINER VIEW WARNINGS
-- Convert problematic views to secure SECURITY INVOKER functions

-- =============================================================================
-- DROP PROBLEMATIC VIEWS AND REPLACE WITH SECURE FUNCTIONS
-- =============================================================================

-- Drop the views that are causing security warnings
DROP VIEW IF EXISTS public.v_clients_public CASCADE;
DROP VIEW IF EXISTS public.v_invoices_summary CASCADE;  
DROP VIEW IF EXISTS public.v_expenses_summary CASCADE;

-- =============================================================================
-- 1. REPLACE CLIENTS VIEW WITH SECURE FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_clients_safe()
RETURNS TABLE (
  id uuid,
  name text,
  company_name text,
  address_city text,
  address_country text,
  website text,
  archived boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  org_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Use SECURITY INVOKER to respect RLS
SET search_path = public
AS $$
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
  WHERE c.deleted_at IS NULL
    AND c.org_id IN (SELECT public.user_org_ids());
$$;

-- Grant permissions  
GRANT EXECUTE ON FUNCTION public.get_clients_safe() TO authenticated;
REVOKE ALL ON FUNCTION public.get_clients_safe() FROM public;

COMMENT ON FUNCTION public.get_clients_safe() IS 'SAFE FUNCTION: Returns only non-sensitive client fields for org members. Sensitive data requires editor+ role via get_client_sensitive_data()';

-- =============================================================================
-- 2. REPLACE INVOICES VIEW WITH SECURE FUNCTION  
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_invoices_safe()
RETURNS TABLE (
  id uuid,
  number text,
  client_id uuid,
  status text,
  issue_date date,
  due_date date,
  currency character,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  org_id uuid,
  project_count integer
)
LANGUAGE sql
STABLE  
SECURITY INVOKER  -- Use SECURITY INVOKER to respect RLS
SET search_path = public
AS $$
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
  WHERE i.deleted_at IS NULL
    AND i.org_id IN (SELECT public.user_org_ids());
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_invoices_safe() TO authenticated;
REVOKE ALL ON FUNCTION public.get_invoices_safe() FROM public;

COMMENT ON FUNCTION public.get_invoices_safe() IS 'SAFE FUNCTION: Returns invoice metadata without financial amounts for org members. Financial data requires editor+ role via get_invoice_financial_data()';

-- =============================================================================
-- 3. REPLACE EXPENSES VIEW WITH SECURE FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_expenses_safe()
RETURNS TABLE (
  id uuid,
  project_id uuid,
  client_id uuid,
  spent_on date,
  vendor text,
  category text,
  description text,
  currency character,
  billable boolean,
  reimbursable boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  org_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Use SECURITY INVOKER to respect RLS  
SET search_path = public
AS $$
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
  WHERE e.deleted_at IS NULL
    AND e.org_id IN (SELECT public.user_org_ids());
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_expenses_safe() TO authenticated;
REVOKE ALL ON FUNCTION public.get_expenses_safe() FROM public;

COMMENT ON FUNCTION public.get_expenses_safe() IS 'SAFE FUNCTION: Returns expense metadata without financial amounts for org members. Financial data requires editor+ role via get_expense_financial_data()';

-- Migration complete: All security definer views replaced with secure SECURITY INVOKER functions