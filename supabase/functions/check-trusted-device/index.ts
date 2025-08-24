import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    console.log('Request headers:', { 
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'x-real-ip': req.headers.get('x-real-ip'),
      'user-agent': userAgent,
      'final-ip': clientIP
    })
    
    // Generate device hash
    const deviceHash = await generateDeviceHash(userAgent, clientIP)
    
    // Parse request body to check for action
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = body.action || 'check'
    
    if (action === 'add') {
      // Add device as trusted
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now
      
      const { error: insertError } = await supabase
        .from('mfa_trusted_devices')
        .upsert({
          user_id: user.id,
          device_hash: deviceHash,
          device_name: `Device - ${new Date().toLocaleDateString()}`,
          expires_at: expiresAt.toISOString(),
          last_used_at: new Date().toISOString()
        })
      
      if (insertError) {
        console.error('Error adding trusted device:', insertError)
        throw insertError
      }
      
      // Log the trusted device addition
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          event_type: 'trusted_device_added',
          details: { 
            device_hash: deviceHash.substring(0, 8) + '...',
            expires_at: expiresAt.toISOString()
          },
          ip_address: clientIP,
          user_agent: userAgent
        })
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Device added as trusted',
          expires_at: expiresAt.toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Default: Check if device is trusted
    const { data: trustedDevice, error } = await supabase
      .from('mfa_trusted_devices')
      .select('id, expires_at, last_used_at')
      .eq('user_id', user.id)
      .eq('device_hash', deviceHash)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    const isTrusted = !!trustedDevice

    if (isTrusted) {
      // Update last used timestamp
      await supabase
        .from('mfa_trusted_devices')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', trustedDevice.id)

      // Log the trusted device usage
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          event_type: 'trusted_device_used',
          details: { device_hash: deviceHash.substring(0, 8) + '...' },
          ip_address: clientIP,
          user_agent: userAgent
        })
    }

    return new Response(
      JSON.stringify({ 
        is_trusted: isTrusted,
        expires_at: trustedDevice?.expires_at || null
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Error in trusted device function:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process trusted device request' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function generateDeviceHash(userAgent: string, ip: string): Promise<string> {
  // Clean and normalize the input to avoid hash variations
  const cleanUserAgent = userAgent.replace(/\s+/g, ' ').trim()
  const cleanIP = ip.split(',')[0].trim() // Take only first IP if there are multiple
  
  const deviceString = `${cleanUserAgent}-${cleanIP}`
  console.log('Generating device hash for:', { userAgent: cleanUserAgent, ip: cleanIP, deviceString })
  
  const encoder = new TextEncoder()
  const data = encoder.encode(deviceString)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashString = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  console.log('Generated device hash:', hashString)
  return hashString
}