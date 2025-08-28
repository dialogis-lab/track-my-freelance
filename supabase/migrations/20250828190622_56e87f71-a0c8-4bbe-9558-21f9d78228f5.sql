-- Fix URL validation constraint for clients.website field
-- Allow common URL formats and normalize before save

-- 1) Drop old constraint if exists
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_website_format;

-- 2) Add new permissive constraint (case-insensitive)
-- Accepts: optional http(s), domain with subdomains, TLD 2–24, optional path/query/fragment
-- Allows NULL/empty
ALTER TABLE public.clients
  ADD CONSTRAINT clients_website_format
  CHECK (
    website IS NULL
    OR website = ''
    OR website ~* '^(https?://)?([a-z0-9-]+\.)+[a-z]{2,24}(:[0-9]{2,5})?(/[^\s]*)?$'
  );