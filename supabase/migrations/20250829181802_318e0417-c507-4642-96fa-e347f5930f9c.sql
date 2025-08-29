-- Add comprehensive RLS policies for invoice_seq table to prevent manipulation
-- The invoice_seq table is critical for invoice numbering integrity

-- Policy to explicitly deny INSERT operations to all users
-- Only the system functions should be able to create/modify invoice sequences
CREATE POLICY "Deny all INSERT on invoice_seq" 
ON public.invoice_seq 
FOR INSERT 
TO authenticated, anon
WITH CHECK (false);

-- Policy to explicitly deny UPDATE operations to all users  
-- Only the generate_invoice_number() function (SECURITY DEFINER) should update this
CREATE POLICY "Deny all UPDATE on invoice_seq" 
ON public.invoice_seq 
FOR UPDATE 
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- Policy to explicitly deny DELETE operations to all users
-- Invoice sequences should never be deleted to maintain audit trail
CREATE POLICY "Deny all DELETE on invoice_seq" 
ON public.invoice_seq 
FOR DELETE 
TO authenticated, anon
USING (false);

-- Note: The existing SELECT policy "Only admins can read invoice sequence" remains unchanged
-- This allows admins to view the current sequence state for monitoring purposes