-- Fix security warnings from the linter

-- 1. Drop the problematic views that expose auth.users
DROP VIEW IF EXISTS public.admin_user_stats;
DROP VIEW IF EXISTS public.admin_invoice_stats;

-- 2. Create secure functions instead of views to get admin stats
CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only allow admins to access this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'new_last_7_days', (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days'),
    'active_last_7_days', (SELECT COUNT(*) FROM profiles WHERE updated_at >= NOW() - INTERVAL '7 days'),
    'waitlist_count', (SELECT COUNT(*) FROM leads)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 3. Create function for invoice stats
CREATE OR REPLACE FUNCTION public.get_admin_invoice_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only allow admins to access this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_build_object(
    'total_invoices', COUNT(*),
    'total_revenue_minor', COALESCE(SUM(total_minor), 0),
    'invoices_last_30_days', COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)
  ) INTO result
  FROM invoices;
  
  RETURN result;
END;
$$;

-- 4. Create function to get new users over time (for charts)
CREATE OR REPLACE FUNCTION public.get_admin_new_users_chart(days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only allow admins to access this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_agg(
    json_build_object(
      'date', date_trunc('day', created_at)::date,
      'count', COUNT(*)
    ) ORDER BY date_trunc('day', created_at)
  ) INTO result
  FROM auth.users 
  WHERE created_at >= NOW() - (days || ' days')::INTERVAL
  GROUP BY date_trunc('day', created_at);
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 5. Update search_path for existing functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1
$$;