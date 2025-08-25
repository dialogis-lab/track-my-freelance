-- Allow admins to read leads (waitlist data)
CREATE POLICY "Admins can view all leads" 
ON public.leads 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));