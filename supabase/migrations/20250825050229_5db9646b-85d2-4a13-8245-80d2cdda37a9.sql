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
$function$;