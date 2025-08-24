-- Add encrypted columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN bank_details_enc jsonb,
ADD COLUMN vat_id_enc jsonb;

-- Add encrypted private notes to time_entries table  
ALTER TABLE public.time_entries
ADD COLUMN is_private boolean NOT NULL DEFAULT false,
ADD COLUMN private_notes_enc jsonb;