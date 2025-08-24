-- Add invoicing fields to clients table
ALTER TABLE public.clients 
ADD COLUMN company_name TEXT,
ADD COLUMN contact_person TEXT,
ADD COLUMN email TEXT,
ADD COLUMN phone TEXT,
ADD COLUMN address_street TEXT,
ADD COLUMN address_city TEXT,
ADD COLUMN address_postal_code TEXT,
ADD COLUMN address_country TEXT DEFAULT 'Germany',
ADD COLUMN vat_id TEXT,
ADD COLUMN tax_number TEXT,
ADD COLUMN website TEXT,
ADD COLUMN notes TEXT,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger for updating updated_at timestamp
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add some constraints for data quality
ALTER TABLE public.clients 
ADD CONSTRAINT clients_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT clients_website_format CHECK (website IS NULL OR website ~* '^https?://.*');

-- Create index for better performance on email lookups
CREATE INDEX idx_clients_email ON public.clients(email) WHERE email IS NOT NULL;