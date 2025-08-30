-- Remove trusted_devices table and cleanup MFA-related infrastructure
DROP POLICY IF EXISTS "Users can manage their own trusted devices" ON trusted_devices;
DROP TABLE IF EXISTS trusted_devices CASCADE;

-- Note: Keeping mfa_recovery_codes and mfa_rate_limits tables in case MFA is re-enabled later
-- These can be manually dropped if MFA is permanently removed