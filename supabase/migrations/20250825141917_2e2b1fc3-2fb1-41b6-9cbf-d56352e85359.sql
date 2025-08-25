-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL, -- reference existing projects table
  client_id uuid,           -- optional: denormalize from project for reporting
  spent_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  vendor text,
  category text,
  description text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,             -- e.g. 2.5 km, 3.0 pcs
  unit_amount_cents integer NOT NULL DEFAULT 0,          -- in cents
  currency char(3) NOT NULL DEFAULT 'CHF',
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,              -- e.g. 7.7
  net_amount_cents integer NOT NULL DEFAULT 0,
  vat_amount_cents integer NOT NULL DEFAULT 0,
  gross_amount_cents integer NOT NULL DEFAULT 0,
  billable boolean NOT NULL DEFAULT true,
  reimbursable boolean NOT NULL DEFAULT false,
  receipt_url text,                                      -- Supabase Storage path
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
    ALTER TABLE expenses ADD CONSTRAINT fk_expenses_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
    ALTER TABLE expenses ADD CONSTRAINT fk_expenses_client  
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_client ON expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_spent_on ON expenses(spent_on);

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expenses' AND policyname='owner can read') THEN
    CREATE POLICY "owner can read" ON expenses FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expenses' AND policyname='owner can write') THEN
    CREATE POLICY "owner can write" ON expenses FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Server-side calculator (authoritative amounts)
CREATE OR REPLACE FUNCTION expense_calculate_amounts(
  p_quantity numeric, p_unit_cents integer, p_vat_rate numeric
) RETURNS TABLE (net_cents integer, vat_cents integer, gross_cents integer)
LANGUAGE plpgsql AS $$
DECLARE 
  net integer; 
  vat integer; 
  gross integer;
BEGIN
  net := round( (p_quantity * p_unit_cents)::numeric );
  vat := round( (net * (p_vat_rate/100))::numeric );
  gross := net + vat;
  RETURN QUERY SELECT net, vat, gross;
END $$;

-- Upsert via RPC (serverside amounts)
CREATE OR REPLACE FUNCTION expense_upsert(
  p_id uuid,
  p_project_id uuid,
  p_client_id uuid,
  p_spent_on date,
  p_vendor text,
  p_category text,
  p_description text,
  p_quantity numeric,
  p_unit_amount_cents integer,
  p_currency char(3),
  p_vat_rate numeric,
  p_billable boolean,
  p_reimbursable boolean,
  p_receipt_url text
) RETURNS expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE 
  net integer; 
  vat integer; 
  gr integer; 
  rec expenses;
BEGIN
  SELECT net_cents, vat_cents, gross_cents
    INTO net, vat, gr
  FROM expense_calculate_amounts(p_quantity, p_unit_amount_cents, p_vat_rate);

  IF p_id IS NULL THEN
    INSERT INTO expenses(
      user_id, project_id, client_id, spent_on, vendor, category, description,
      quantity, unit_amount_cents, currency, vat_rate,
      net_amount_cents, vat_amount_cents, gross_amount_cents,
      billable, reimbursable, receipt_url
    ) VALUES (
      auth.uid(), p_project_id, p_client_id, COALESCE(p_spent_on, (now() AT TIME ZONE 'utc')::date),
      p_vendor, p_category, p_description,
      p_quantity, p_unit_amount_cents, upper(p_currency), p_vat_rate,
      net, vat, gr,
      COALESCE(p_billable,true), COALESCE(p_reimbursable,false), p_receipt_url
    )
    RETURNING * INTO rec;
  ELSE
    UPDATE expenses SET
      project_id = p_project_id,
      client_id  = p_client_id,
      spent_on   = p_spent_on,
      vendor     = p_vendor,
      category   = p_category,
      description= p_description,
      quantity   = p_quantity,
      unit_amount_cents = p_unit_amount_cents,
      currency   = upper(p_currency),
      vat_rate   = p_vat_rate,
      net_amount_cents = net,
      vat_amount_cents = vat,
      gross_amount_cents = gr,
      billable   = COALESCE(p_billable, billable),
      reimbursable = COALESCE(p_reimbursable, reimbursable),
      receipt_url = p_receipt_url
    WHERE id = p_id AND user_id = auth.uid()
    RETURNING * INTO rec;
  END IF;

  RETURN rec;
END $$;

-- Realtime for expenses
ALTER TABLE IF EXISTS expenses REPLICA IDENTITY FULL;
DO $$ 
BEGIN
  BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE expenses; 
  EXCEPTION WHEN duplicate_object THEN 
    NULL; 
  END;
END $$;

-- Storage bucket for receipts (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts
CREATE POLICY "Users can upload their own receipts" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own receipts" ON storage.objects
FOR SELECT USING (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own receipts" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own receipts" ON storage.objects
FOR DELETE USING (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);