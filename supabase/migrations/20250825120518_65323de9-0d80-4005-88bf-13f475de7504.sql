-- Remove hardcoded Germany default from database
ALTER TABLE public.clients 
ALTER COLUMN address_country DROP DEFAULT;