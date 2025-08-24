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
    
    // Generate device hash
    const deviceHash = await generateDeviceHash(userAgent, clientIP)
    
    // Check if device is trusted and not expired
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
    console.error('Error checking trusted device:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to check trusted device status' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function generateDeviceHash(userAgent: string, ip: string): Promise<string> {
  const deviceString = `${userAgent}-${ip}`
  const encoder = new TextEncoder()
  const data = encoder.encode(deviceString)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}