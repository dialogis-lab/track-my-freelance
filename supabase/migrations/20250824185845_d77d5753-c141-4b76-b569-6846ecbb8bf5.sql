-- Add missing fields to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS issue_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS number TEXT;

-- Create invoice_items table for line items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  minutes INTEGER NOT NULL DEFAULT 0,
  rate_minor INTEGER NOT NULL DEFAULT 0,
  amount_minor INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice sequence table for auto-numbering
CREATE TABLE IF NOT EXISTS public.invoice_seq (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Insert initial row if not exists
INSERT INTO public.invoice_seq (id, last_number) 
VALUES (1, 0) 
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_seq ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoice_items
CREATE POLICY IF NOT EXISTS "Users can manage their own invoice items"
ON public.invoice_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

-- Create RLS policy for invoice_seq (read-only for authenticated users)
CREATE POLICY IF NOT EXISTS "Users can read invoice sequence"
ON public.invoice_seq
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  current_year TEXT;
  invoice_number TEXT;
BEGIN
  -- Get current year
  current_year := EXTRACT(year FROM CURRENT_DATE)::TEXT;
  
  -- Atomically increment and get next number
  UPDATE public.invoice_seq 
  SET last_number = last_number + 1 
  WHERE id = 1 
  RETURNING last_number INTO next_number;
  
  -- Format as YYYY-#### 
  invoice_number := current_year || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN invoice_number;
END;
$$;