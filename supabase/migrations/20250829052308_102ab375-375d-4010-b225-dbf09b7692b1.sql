-- Fix security vulnerability: Restrict invoice_seq access to admin users only
-- Remove the overly permissive policy that allows any authenticated user to read invoice sequence
DROP POLICY IF EXISTS "Users can read invoice sequence" ON public.invoice_seq;

-- Create a restrictive policy that only allows admin users to read the invoice sequence
CREATE POLICY "Only admins can read invoice sequence"
  ON public.invoice_seq
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Note: The generate_invoice_number() function uses SECURITY DEFINER which allows it to
-- access the table regardless of RLS policies, so invoice generation will still work
-- for regular users through the proper function interface