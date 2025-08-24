# MFA Security Model - TimeHatch

## Overview

TimeHatch implements a production-grade Multi-Factor Authentication (MFA) system with comprehensive security hardening, audit logging, and email notifications. This document outlines the security model and implementation details.

## 🔒 Security Features

### Recovery Codes
- **Hashing**: All recovery codes are stored hashed using SHA-256
- **Single-use**: Codes are automatically invalidated after use (`used=true`)
- **RLS Protection**: Row-Level Security ensures users can only access their own codes
- **No Plaintext**: Recovery codes are never stored or returned in plaintext from the database

### TOTP Verification
- **Rate Limiting**: Maximum 5 attempts per minute per user
- **Time Skew Tolerance**: ±1 time-step (±30 seconds) for clock drift compensation
- **Secure Verification**: All verifications go through hardened edge functions

### Enable/Disable MFA
- **Recent Authentication**: Requires valid session (handled by Supabase auth)
- **Complete Cleanup**: Disabling MFA removes all recovery codes and trusted devices
- **Audit Trail**: All enable/disable actions are logged with IP and timestamp

### Email Notifications
- **Event Triggers**: Notifications sent for MFA enabled, disabled, and recovery code usage
- **Security Details**: Emails include IP address, timestamp, and user agent
- **Support Contact**: All emails include security team contact information
- **Templates**: Professional email templates with security context

### Trusted Devices (30-day remember)
- **Device Fingerprinting**: SHA-256 hash of User-Agent and IP address
- **Secure Cookies**: HttpOnly, Secure, SameSite=Strict cookies
- **Automatic Expiry**: 30-day maximum lifetime with cleanup functions
- **Revocation**: Users can revoke individual devices or all devices
- **Usage Tracking**: Last used timestamps for monitoring

### Session Security
- **MFA Session Elevation**: AAL2 level required for sensitive operations
- **Logout Protection**: MFA sessions and trusted device cookies cleared on logout
- **Multi-device Management**: "Sign out from all devices" functionality

### Audit Logging
- **Comprehensive Events**:
  - `mfa_enabled` - Two-factor authentication enabled
  - `mfa_disabled` - Two-factor authentication disabled
  - `mfa_challenge` - MFA challenge initiated
  - `mfa_success` - Successful MFA verification
  - `mfa_failure` - Failed MFA verification attempt
  - `recovery_code_used` - Recovery code utilized
  - `trusted_device_used` - Trusted device bypass used
  - `trusted_device_revoked` - Device trust revoked
  - `recovery_codes_regenerated` - New recovery codes generated

- **Immutable Logs**: Insert-only audit logs with RLS protection
- **Rich Context**: IP address, user agent, timestamps, and event details
- **Performance Indexed**: Optimized queries by user and event type

## 🛡️ Security Implementation

### Database Schema

```sql
-- Audit logs for security events
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trusted devices for 30-day remember
CREATE TABLE public.mfa_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_hash TEXT NOT NULL,
  device_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, device_hash)
);

-- Rate limiting for MFA attempts
CREATE TABLE public.mfa_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempts INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);
```

### Edge Functions

1. **`secure-mfa-verify`**: Hardened MFA verification with rate limiting
2. **`mfa-email-notifications`**: Security event email notifications
3. **`check-trusted-device`**: Trusted device validation
4. **`generate-recovery-codes`**: Secure recovery code generation with audit logging

### Rate Limiting Algorithm

```typescript
const RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  WINDOW_MINUTES: 1,
}

// Sliding window rate limiting per user
// Blocks user for remainder of window after max attempts
// Automatic cleanup of old rate limit records
```

### Device Fingerprinting

```typescript
async function generateDeviceHash(userAgent: string, ip: string): Promise<string> {
  const deviceString = `${userAgent}-${ip}`
  const encoder = new TextEncoder()
  const data = encoder.encode(deviceString)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

## 📧 Email Security Notifications

### Event Types

1. **MFA Enabled**
   - Subject: "TimeHatch: Two-Factor Authentication Enabled"
   - Content: Confirmation with security details
   - Action: None required if legitimate

2. **MFA Disabled**  
   - Subject: "TimeHatch: Two-Factor Authentication Disabled"
   - Content: **SECURITY ALERT** with immediate action steps
   - Action: Contact security team if unauthorized

3. **Recovery Code Used**
   - Subject: "TimeHatch: A Recovery Code Was Used"
   - Content: Usage details and remaining code count
   - Action: Monitor for unauthorized access

### Email Content Security
- **Professional Templates**: Branded security notifications
- **Rich Context**: IP, timestamp, user agent, device information  
- **Action Guidance**: Clear next steps for users
- **Contact Information**: Direct security team contact
- **Abuse Prevention**: Rate limiting on email notifications

## 🔐 Best Practices Implemented

### Authentication Flow
1. User enters credentials → Basic authentication (AAL1)
2. System checks for MFA requirement → Challenge initiated
3. Trusted device check → Skip MFA if valid trust exists
4. MFA verification → Rate limited and audited
5. Successful MFA → Session elevated to AAL2
6. Optional device trust → 30-day remember option

### Security Considerations
- **No Client-Side Secrets**: All sensitive operations server-side
- **Encrypted Storage**: All sensitive data hashed or encrypted
- **Audit Everything**: Comprehensive logging of security events
- **Defense in Depth**: Multiple layers of protection
- **Graceful Degradation**: System remains functional if MFA fails
- **User Experience**: Balances security with usability

### Monitoring & Alerts
- **Failed Attempt Patterns**: Rate limiting with automatic blocking
- **Geographic Anomalies**: IP-based device fingerprinting
- **Time-based Analysis**: Unusual access patterns in audit logs
- **Recovery Code Exhaustion**: Warnings when codes run low

## 🚀 Production Deployment Checklist

### Supabase Configuration
- [ ] Enable leaked password protection
- [ ] Set appropriate OTP expiry times
- [ ] Configure proper SMTP settings for emails
- [ ] Set up database backup and recovery
- [ ] Enable database connection pooling

### Environment Variables
- [ ] `RESEND_API_KEY` - Email notification service
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Secure function access
- [ ] All secrets properly configured in Supabase vault

### Monitoring Setup
- [ ] Database query monitoring
- [ ] Edge function performance monitoring  
- [ ] Email delivery monitoring
- [ ] Rate limiting effectiveness monitoring
- [ ] Audit log retention policies

### Security Validation
- [ ] Penetration testing of MFA flow
- [ ] Rate limiting effectiveness testing
- [ ] Email delivery and content validation
- [ ] Recovery code generation and usage testing
- [ ] Trusted device lifecycle testing
- [ ] Session security validation

## 📞 Support & Security Contact

For security-related issues or questions about the MFA implementation:

- **Security Team**: security@timehatch.com
- **General Support**: support@timehatch.com
- **Emergency**: Include "SECURITY URGENT" in subject line

## 🔄 Maintenance Tasks

### Automated Cleanup (Recommended Cron Jobs)
```sql
-- Daily cleanup of expired trusted devices
SELECT public.cleanup_expired_trusted_devices();

-- Hourly cleanup of old rate limit records  
SELECT public.cleanup_old_rate_limits();

-- Weekly audit log archival (implement as needed)
-- Archive logs older than 90 days to separate table
```

### Manual Maintenance
- Review audit logs for suspicious patterns monthly
- Validate email delivery metrics weekly
- Test MFA flow end-to-end monthly
- Review and update security documentation quarterly

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Author**: TimeHatch Security Team