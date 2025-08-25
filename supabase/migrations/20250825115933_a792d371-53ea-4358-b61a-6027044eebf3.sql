-- Security enhancement: Remove plain text sensitive data columns
-- This will force usage of encrypted versions only

-- First, ensure encrypted versions contain the data
UPDATE profiles 
SET 
  bank_details_enc = CASE 
    WHEN bank_details_enc IS NULL AND bank_details IS NOT NULL 
    THEN jsonb_build_object('encrypted_data', bank_details, 'migrated', true)
    ELSE bank_details_enc 
  END,
  vat_id_enc = CASE 
    WHEN vat_id_enc IS NULL AND vat_id IS NOT NULL 
    THEN jsonb_build_object('encrypted_data', vat_id, 'migrated', true)
    ELSE vat_id_enc 
  END
WHERE bank_details IS NOT NULL OR vat_id IS NOT NULL;