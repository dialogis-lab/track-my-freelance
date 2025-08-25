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
$function$;