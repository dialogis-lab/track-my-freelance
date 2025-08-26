-- Enhanced security for clients table
-- Drop existing policy to recreate with better security
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;

-- Create more secure RLS policies with explicit authentication checks
CREATE POLICY "Authenticated users can view their own clients"
ON public.clients
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "Authenticated users can insert their own clients"
ON public.clients
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "Authenticated users can update their own clients"
ON public.clients
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "Authenticated users can delete their own clients"
ON public.clients
FOR DELETE
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- Ensure RLS is enabled (should already be enabled but double-check)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create a function to validate client access (for additional security in edge functions)
CREATE OR REPLACE FUNCTION public.user_can_access_client(client_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = client_id 
    AND user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  );
$$;