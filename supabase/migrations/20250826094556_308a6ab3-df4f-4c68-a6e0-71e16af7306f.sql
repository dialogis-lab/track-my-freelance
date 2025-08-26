-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.user_can_access_client(client_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = client_id 
    AND user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  );
$$;