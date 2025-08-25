-- Fix search path for expense_calculate_amounts function
CREATE OR REPLACE FUNCTION expense_calculate_amounts(
  p_quantity numeric, p_unit_cents integer, p_vat_rate numeric
) RETURNS TABLE (net_cents integer, vat_cents integer, gross_cents integer)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public AS $$
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

-- Fix search path for set_updated_at function  
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;