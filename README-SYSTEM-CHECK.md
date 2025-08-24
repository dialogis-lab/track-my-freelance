# System Diagnostics - TimeHatch

This guide explains how to use the `/system-check` developer diagnostics page to test system functionality and troubleshoot issues.

## Access

The system diagnostics page is only available to authenticated users and when:
- Running in development mode (`NODE_ENV=development` or `import.meta.env.DEV=true`)
- OR when `VITE_ENABLE_SYSTEM_CHECK=true` is set in environment variables

Access the page at: `/system-check`

A "Dev" link will appear in the footer when diagnostics are available.

## Environment Variables Required

### Core Application
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Optional Features
- `VITE_ENABLE_SYSTEM_CHECK=true` - Enable diagnostics in production
- `RESEND_API_KEY` - Required for email functionality testing

## Available Diagnostics

### 1. Environment Variables Check
- Verifies presence of required environment variables
- Masks sensitive keys for security
- **Status**: ✅ PASS if all required vars present, ❌ FAIL if missing

### 2. Supabase Connectivity
- Tests basic connection to Supabase database
- Attempts to query the projects table
- **Status**: ✅ PASS if connection successful, ❌ FAIL if connection fails

### 3. Authentication Session
- Displays current user authentication status
- Shows user ID and email if logged in
- **Status**: ✅ PASS if authenticated, ❌ FAIL if not logged in

### 4. Database Tables Existence
- Checks accessibility of all core tables:
  - `clients`
  - `projects` 
  - `time_entries`
  - `reminders`
  - `leads`
- **Status**: ✅ PASS if all tables accessible, ❌ FAIL if any issues

### 5. Row Level Security (RLS) Policies
- Tests that RLS policies are working correctly
- Attempts to insert a test record to verify user-level access
- **Status**: ✅ PASS if RLS working, ❌ FAIL if misconfigured

### 6. Overlapping Timer Prevention
- Tests the database trigger that prevents multiple running timers
- Creates test project and attempts to start overlapping timers
- **Status**: ✅ PASS if overlap prevented, ❌ FAIL if multiple timers allowed

### 7. CSV Export Functionality
- Tests the export-csv edge function
- Attempts to generate a CSV for the past week
- **Status**: ✅ PASS if CSV generated, ❌ FAIL if export fails

### 8. Email Service (Resend)
- Tests email functionality via reminders-cron edge function
- Sends a test email to the logged-in user
- **Status**: ✅ PASS if test email sent, ❌ FAIL if email service unavailable

## QA Testing Tools

### Insert Demo Client/Project
- Creates test client and project records
- Useful for testing with fresh data
- **Requires**: Active user session

### Start & Stop Test Timer
- Creates a 1-minute completed time entry
- Tests timer functionality end-to-end
- **Requires**: Demo project to be created first

### Download CSV (This Week)
- Downloads a CSV export of this week's time entries
- Tests the complete CSV export workflow
- **File**: Downloads as `test-report.csv`

### Send Test Email
- Sends a test email to verify email functionality
- Uses reminders-cron edge function in test mode
- **Requires**: `RESEND_API_KEY` environment variable

## Troubleshooting

### Common Issues

**❌ Environment Variables Missing**
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Check that variables start with `VITE_` prefix for Vite applications

**❌ Supabase Connection Failed**
- Verify Supabase project is running
- Check that URL and key are correct
- Ensure network connectivity

**❌ Authentication Required**
- Log in before accessing diagnostics
- Check that session is active

**❌ RLS Policy Issues**
- Verify Row Level Security is enabled on tables
- Check that policies allow user to access their own data
- User ID must match policy conditions

**❌ CSV Export Failed**
- Check that export-csv edge function is deployed
- Verify user has time entries in the date range
- Check edge function logs in Supabase dashboard

**❌ Email Test Failed**
- Ensure `RESEND_API_KEY` is configured in Supabase secrets
- Verify Resend account is active and API key is valid
- Check edge function logs for detailed error messages

### Getting Help

1. **Check the console** - Browser developer tools show detailed error messages
2. **Review edge function logs** - Supabase dashboard shows function execution logs
3. **Test individual components** - Use QA tools to isolate issues
4. **Verify environment** - Ensure all required variables are set

## Security Notes

- System diagnostics should never be enabled in production without proper access controls
- Sensitive information is masked in diagnostic output
- Test emails are only sent to the authenticated user
- All database operations respect Row Level Security policies

## Implementation Details

The system check page is implemented in:
- **Frontend**: `src/pages/SystemCheck.tsx`
- **Edge Functions**: 
  - `supabase/functions/export-csv/index.ts`
  - `supabase/functions/reminders-cron/index.ts`
- **Database**: RLS policies on all core tables
- **Layout**: Dev link in `src/components/AppLayout.tsx`