-- Fix security definer view issues by recreating views properly

-- 1) Drop and recreate v_my_orgs without problematic constructs
DROP VIEW IF EXISTS public.v_my_orgs;

-- Create the view without SECURITY DEFINER - let RLS handle security
CREATE VIEW public.v_my_orgs AS
SELECT org_id
FROM public.org_members
WHERE user_id = auth.uid() AND deleted_at IS NULL;

-- 2) Ensure v_clients_safe properly inherits RLS from base table
DROP VIEW IF EXISTS public.v_clients_safe;

-- Recreate without any security definer properties
CREATE VIEW public.v_clients_safe AS
SELECT 
  id, 
  org_id, 
  name, 
  company_name, 
  contact_person,
  address_street,
  address_city, 
  address_postal_code,
  address_country, 
  website,
  notes,
  archived,
  created_at,
  updated_at
FROM public.clients
WHERE deleted_at IS NULL;

-- Ensure proper permissions
GRANT SELECT ON public.v_clients_safe TO authenticated;
REVOKE SELECT ON public.v_clients_safe FROM anon;