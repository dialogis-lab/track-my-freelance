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
$function$;