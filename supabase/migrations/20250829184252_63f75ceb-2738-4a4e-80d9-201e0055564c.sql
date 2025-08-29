-- Fix Security Definer View Issue (Corrected)
-- Remove the problematic SECURITY DEFINER view and fix trigger conflicts

-- 1. DROP the problematic SECURITY DEFINER view
DROP VIEW IF EXISTS public.clients_safe_view;

-- 2. PROPERLY DROP AND RECREATE TRIGGER
-- First drop any existing triggers that might conflict
DROP TRIGGER IF EXISTS clients_sensitive_audit_trigger ON public.clients;
DROP TRIGGER IF EXISTS clients_sensitive_audit_enhanced ON public.clients;

-- Now create the correct trigger for write operations only
CREATE TRIGGER clients_sensitive_audit_enhanced
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_sensitive_client_access_enhanced();

-- 3. GRANT PERMISSIONS FOR EXISTING SAFE FUNCTIONS
-- Make sure the existing safe functions can be used by authenticated users
GRANT EXECUTE ON FUNCTION public.get_clients_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_sensitive_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_data_with_security_level(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_client_data_secure(UUID[], BOOLEAN) TO authenticated;