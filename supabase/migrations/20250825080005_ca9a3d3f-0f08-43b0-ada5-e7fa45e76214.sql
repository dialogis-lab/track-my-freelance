-- Fix search path for server_time function
CREATE OR REPLACE FUNCTION server_time()
RETURNS timestamptz
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT now();
$$;