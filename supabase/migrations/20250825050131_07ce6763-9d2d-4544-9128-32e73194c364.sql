-- Fix the admin stats function with nested aggregates issue
CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  total_users_count INTEGER;
  new_users_count INTEGER;
  active_users_count INTEGER;
  waitlist_count INTEGER;
BEGIN
  -- Only allow admins to access this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get counts separately to avoid nested aggregates
  SELECT COUNT(*) INTO total_users_count FROM auth.users;
  SELECT COUNT(*) INTO new_users_count FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days';
  SELECT COUNT(*) INTO active_users_count FROM profiles WHERE updated_at >= NOW() - INTERVAL '7 days';
  SELECT COUNT(*) INTO waitlist_count FROM leads;
  
  SELECT json_build_object(
    'total_users', total_users_count,
    'new_last_7_days', new_users_count,
    'active_last_7_days', active_users_count,
    'waitlist_count', waitlist_count
  ) INTO result;
  
  RETURN result;
END;
$function$

-- Fix the invoice stats function as well
CREATE OR REPLACE FUNCTION public.get_admin_invoice_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  total_invoices_count INTEGER;
  total_revenue BIGINT;
  recent_invoices_count INTEGER;
BEGIN
  -- Only allow admins to access this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get counts separately to avoid nested aggregates
  SELECT COUNT(*) INTO total_invoices_count FROM invoices;
  SELECT COALESCE(SUM(total_minor), 0) INTO total_revenue FROM invoices;
  SELECT COUNT(*) INTO recent_invoices_count FROM invoices WHERE created_at >= NOW() - INTERVAL '30 days';
  
  SELECT json_build_object(
    'total_invoices', total_invoices_count,
    'total_revenue_minor', total_revenue,
    'invoices_last_30_days', recent_invoices_count
  ) INTO result;
  
  RETURN result;
END;
$function$

-- Create a new function to get user details for admin
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  -- Only allow admins to access this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', u.id,
      'email', u.email,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'email_confirmed_at', u.email_confirmed_at,
      'company_name', p.company_name,
      'role', COALESCE(ur.role, 'user'::app_role)
    ) ORDER BY u.created_at DESC
  ) INTO result
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$