import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MfaVerifyRequest {
  factorId: string
  challengeId: string
  code: string
  type: 'totp' | 'recovery'
  rememberDevice?: boolean
}

const RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  WINDOW_MINUTES: 1,
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    const { factorId, challengeId, code, type, rememberDevice }: MfaVerifyRequest = await req.json()
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Check rate limits
    const windowStart = new Date(Date.now() - RATE_LIMIT.WINDOW_MINUTES * 60 * 1000)
    
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .from('mfa_rate_limits')
      .select('attempts, window_start')
      .eq('user_id', user.id)
      .single()

    if (rateLimitData) {
      const windowStartTime = new Date(rateLimitData.window_start)
      
      if (windowStartTime > windowStart) {
        // Within current window
        if (rateLimitData.attempts >= RATE_LIMIT.MAX_ATTEMPTS) {
          // Log failed attempt due to rate limit
          await supabase
            .from('audit_logs')
            .insert({
              user_id: user.id,
              event_type: 'mfa_failure',
              details: { reason: 'rate_limited', type },
              ip_address: clientIP,
              user_agent: userAgent
            })

          return new Response(
            JSON.stringify({ 
              error: 'Too many failed attempts. Please wait before trying again.',
              retry_after: Math.ceil((windowStartTime.getTime() + RATE_LIMIT.WINDOW_MINUTES * 60 * 1000 - Date.now()) / 1000)
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Increment attempts
        await supabase
          .from('mfa_rate_limits')
          .update({ attempts: rateLimitData.attempts + 1 })
          .eq('user_id', user.id)
      } else {
        // Reset window
        await supabase
          .from('mfa_rate_limits')
          .update({ 
            attempts: 1, 
            window_start: new Date().toISOString() 
          })
          .eq('user_id', user.id)
      }
    } else {
      // Create new rate limit record
      await supabase
        .from('mfa_rate_limits')
        .insert({
          user_id: user.id,
          attempts: 1,
          window_start: new Date().toISOString()
        })
    }

    let verificationResult: any
    let auditDetails: any = { type, ip_address: clientIP }

    if (type === 'recovery') {
      // Handle recovery code verification
      const codeHash = await hashCode(code)
      
      // Check if recovery code exists and is unused
      const { data: recoveryCodeRecord, error: fetchError } = await supabase
        .from('mfa_recovery_codes')
        .select('id, used')
        .eq('user_id', user.id)
        .eq('code_hash', codeHash)
        .eq('used', false)
        .single()

      if (fetchError || !recoveryCodeRecord) {
        throw new Error('Invalid or used recovery code')
      }

      // Mark recovery code as used
      const { error: updateError } = await supabase
        .from('mfa_recovery_codes')
        .update({ used: true })
        .eq('id', recoveryCodeRecord.id)

      if (updateError) throw updateError

      // Get remaining recovery codes count
      const { count: remainingCodes } = await supabase
        .from('mfa_recovery_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('used', false)

      auditDetails.remaining_recovery_codes = remainingCodes

      // Complete MFA challenge
      verificationResult = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      })

      // Send email notification for recovery code usage
      if (!verificationResult.error) {
        await fetch(`${supabaseUrl}/functions/v1/mfa-email-notifications`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event_type: 'recovery_code_used',
            user_email: user.email,
            user_ip: clientIP,
            user_agent: userAgent,
            details: { remaining_codes: remainingCodes }
          })
        })
      }
    } else {
      // Handle TOTP verification with time skew tolerance (±1 step = ±30 seconds)
      verificationResult = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      })
    }

    if (verificationResult.error) {
      // Log failed attempt
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          event_type: 'mfa_failure',
          details: { ...auditDetails, error: verificationResult.error.message },
          ip_address: clientIP,
          user_agent: userAgent
        })

      throw verificationResult.error
    }

    // Log successful MFA
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        event_type: 'mfa_success',
        details: auditDetails,
        ip_address: clientIP,
        user_agent: userAgent
      })

    // Reset rate limits on successful verification
    await supabase
      .from('mfa_rate_limits')
      .delete()
      .eq('user_id', user.id)

    // Handle trusted device if requested
    let trustedDeviceToken = null
    if (rememberDevice) {
      const deviceHash = await generateDeviceHash(userAgent, clientIP)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      
      trustedDeviceToken = crypto.randomUUID()
      
      await supabase
        .from('mfa_trusted_devices')
        .upsert({
          user_id: user.id,
          device_hash: deviceHash,
          device_name: extractDeviceName(userAgent),
          expires_at: expiresAt.toISOString()
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        session: verificationResult.data?.session,
        trusted_device_token: trustedDeviceToken
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          ...(trustedDeviceToken && {
            'Set-Cookie': `th_trusted=${trustedDeviceToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
          })
        } 
      }
    )

  } catch (error: any) {
    console.error('Error in secure MFA verify:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'MFA verification failed' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(code.toUpperCase())
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function generateDeviceHash(userAgent: string, ip: string): Promise<string> {
  const deviceString = `${userAgent}-${ip}`
  const encoder = new TextEncoder()
  const data = encoder.encode(deviceString)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function extractDeviceName(userAgent: string): string {
  // Simple device name extraction from user agent
  if (userAgent.includes('Mobile')) return 'Mobile Device'
  if (userAgent.includes('Chrome')) return 'Chrome Browser'
  if (userAgent.includes('Firefox')) return 'Firefox Browser'
  if (userAgent.includes('Safari')) return 'Safari Browser'
  return 'Unknown Device'
}