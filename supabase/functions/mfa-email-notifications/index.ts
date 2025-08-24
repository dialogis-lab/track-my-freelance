import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailNotificationRequest {
  event_type: 'mfa_enabled' | 'mfa_disabled' | 'recovery_code_used'
  user_email: string
  user_ip?: string
  user_agent?: string
  details?: any
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create supabase client with service role key for audit logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event_type, user_email, user_ip, user_agent, details }: EmailNotificationRequest = await req.json()

    // Get IP from headers if not provided
    const clientIP = user_ip || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' })

    // Log the event to audit logs
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        event_type,
        details: { ...details, triggered_email: true },
        ip_address: clientIP,
        user_agent: user_agent || req.headers.get('user-agent')
      })

    // Prepare email content based on event type
    let subject: string
    let htmlContent: string

    switch (event_type) {
      case 'mfa_enabled':
        subject = 'TimeHatch: Two-Factor Authentication Enabled'
        htmlContent = `
          <h2>Two-Factor Authentication Enabled</h2>
          <p>Two-factor authentication has been successfully enabled for your TimeHatch account.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Time: ${timestamp} UTC</li>
            <li>IP Address: ${clientIP}</li>
            <li>User Agent: ${user_agent || 'Unknown'}</li>
          </ul>
          <p>If you didn't enable 2FA, please contact our support team immediately.</p>
          <p>For security questions, contact us at: <a href="mailto:security@timehatch.com">security@timehatch.com</a></p>
        `
        break

      case 'mfa_disabled':
        subject = 'TimeHatch: Two-Factor Authentication Disabled'
        htmlContent = `
          <h2>Two-Factor Authentication Disabled</h2>
          <p><strong>⚠️ SECURITY ALERT:</strong> Two-factor authentication has been disabled for your TimeHatch account.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Time: ${timestamp} UTC</li>
            <li>IP Address: ${clientIP}</li>
            <li>User Agent: ${user_agent || 'Unknown'}</li>
          </ul>
          <p><strong>If you didn't disable 2FA, your account may be compromised. Please:</strong></p>
          <ol>
            <li>Change your password immediately</li>
            <li>Re-enable two-factor authentication</li>
            <li>Contact our security team</li>
          </ol>
          <p>For immediate assistance, contact us at: <a href="mailto:security@timehatch.com">security@timehatch.com</a></p>
        `
        break

      case 'recovery_code_used':
        subject = 'TimeHatch: A Recovery Code Was Used'
        htmlContent = `
          <h2>Recovery Code Used</h2>
          <p>A recovery code was used to access your TimeHatch account.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Time: ${timestamp} UTC</li>
            <li>IP Address: ${clientIP}</li>
            <li>User Agent: ${user_agent || 'Unknown'}</li>
            <li>Remaining codes: ${details?.remaining_codes || 'Unknown'}</li>
          </ul>
          <p><strong>Important:</strong> This recovery code has been permanently invalidated and cannot be used again.</p>
          <p>If you didn't use this recovery code, please secure your account immediately.</p>
          <p>For security questions, contact us at: <a href="mailto:security@timehatch.com">security@timehatch.com</a></p>
        `
        break

      default:
        throw new Error('Invalid event type')
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: 'TimeHatch Security <security@timehatch.com>',
      to: [user_email],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">TimeHatch Security</h1>
            ${htmlContent}
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated security notification from TimeHatch. 
              Please do not reply to this email.
            </p>
          </div>
        </div>
      `,
    })

    console.log('Security email sent:', emailResponse)

    return new Response(
      JSON.stringify({ success: true, email_id: emailResponse.data?.id }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in MFA email notifications:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to send notification email' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})