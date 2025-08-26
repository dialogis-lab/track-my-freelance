-- Phase 1: Create workspace_keys table for storing Data Encryption Keys (DEKs)
CREATE TABLE IF NOT EXISTS public.workspace_keys (
  workspace_id uuid PRIMARY KEY,
  dek_cipher bytea NOT NULL,
  dek_nonce bytea NOT NULL, 
  dek_tag bytea NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on workspace_keys
ALTER TABLE public.workspace_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage keys for their own workspace (user_id as workspace_id for now)
CREATE POLICY "Users can manage their workspace keys" ON public.workspace_keys
  FOR ALL USING (workspace_id = auth.uid())
  WITH CHECK (workspace_id = auth.uid());

-- Phase 2: Add HMAC fingerprint columns for exact search/uniqueness

-- Add fingerprint columns to profiles
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS billing_email_fp bytea,
  ADD COLUMN IF NOT EXISTS vat_fp bytea,
  ADD COLUMN IF NOT EXISTS iban_fp bytea;

-- Add fingerprint columns to clients  
ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS email_fp bytea,
  ADD COLUMN IF NOT EXISTS tax_id_fp bytea;

-- Add fingerprint columns to invoices
ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS bill_to_email_fp bytea;

-- Add unique indexes for fingerprints where appropriate
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_vat_fp ON public.profiles(vat_fp) WHERE vat_fp IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_fp ON public.clients(email_fp) WHERE email_fp IS NOT NULL;