-- Add encrypted columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN bank_details_enc jsonb,
ADD COLUMN vat_id_enc jsonb;

-- Add private notes support to time_entries table  
ALTER TABLE public.time_entries
ADD COLUMN is_private boolean DEFAULT false,
ADD COLUMN private_notes_enc jsonb;

-- Create storage bucket for invoices (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for invoices bucket
CREATE POLICY "Users can upload their own invoices" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own invoices" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own invoices" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own invoices" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);