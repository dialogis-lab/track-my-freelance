import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Secret key for HMAC validation - in production this should be from environment
const HMAC_SECRET = Deno.env.get('TRUSTED_DEVICE_SECRET') || 'default-secret-key-change-in-production'

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

    const body = await req.json()
    const { action, device_id } = body
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    console.log(`Trusted device action: ${action} for user: ${user.id}`)

    if (action === 'check') {
      return await checkTrustedDevice(req, supabase, user, clientIP, userAgent)
    } else if (action === 'add') {
      return await addTrustedDevice(req, supabase, user, clientIP, userAgent)
    } else if (action === 'revoke') {
      return await revokeTrustedDevice(supabase, user, device_id)
    } else if (action === 'revoke_all') {
      return await revokeAllTrustedDevices(supabase, user)
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in trusted device handler:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function checkTrustedDevice(req: Request, supabase: any, user: any, clientIP: string, userAgent: string) {
  // Get trusted device cookie
  const cookies = req.headers.get('cookie') || ''
  const trustedDeviceCookie = parseCookie(cookies, 'td')
  
  if (!trustedDeviceCookie) {
    return new Response(
      JSON.stringify({ is_trusted: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Parse cookie: format is device_id.hmac
  const [deviceId, hmac] = trustedDeviceCookie.split('.')
  if (!deviceId || !hmac) {
    return new Response(
      JSON.stringify({ is_trusted: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Look up device in database
  const { data: device, error } = await supabase
    .from('trusted_devices')
    .select('*')
    .eq('user_id', user.id)
    .eq('device_id', deviceId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !device) {
    return new Response(
      JSON.stringify({ is_trusted: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate HMAC
  const expectedHmac = await generateHMAC(deviceId, user.id, device.expires_at)
  if (hmac !== expectedHmac) {
    return new Response(
      JSON.stringify({ is_trusted: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Optional: Check if user agent family changed significantly (more lenient)
  const currentUAHash = await sha256(userAgent)
  if (device.ua_hash !== currentUAHash) {
    console.log(`User agent changed for device ${deviceId}, but allowing (trusting user choice)`)
  }

  // Optional: Check IP prefix (more lenient - only log, don't block)
  const currentIPPrefix = getIPPrefix(clientIP)
  if (device.ip_prefix && device.ip_prefix.toString() !== currentIPPrefix) {
    console.log(`IP prefix changed for device ${deviceId}: ${device.ip_prefix} -> ${currentIPPrefix}`)
  }

  // Update last seen
  await supabase
    .from('trusted_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id)

  return new Response(
    JSON.stringify({ 
      is_trusted: true, 
      device_id: deviceId,
      expires_at: device.expires_at 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function addTrustedDevice(req: Request, supabase: any, user: any, clientIP: string, userAgent: string) {
  // Generate 128-bit device ID (32 hex chars)
  const deviceId = crypto.randomUUID().replace(/-/g, '').substring(0, 32)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  const uaHash = await sha256(userAgent)
  const ipPrefix = getIPPrefix(clientIP)

  // Create device record
  const { error } = await supabase
    .from('trusted_devices')
    .upsert({
      user_id: user.id,
      device_id: deviceId,
      ua_hash: uaHash,
      ip_prefix: ipPrefix,
      expires_at: expiresAt.toISOString()
    })

  if (error) {
    throw new Error('Failed to create trusted device record')
  }

  // Generate HMAC for cookie
  const hmac = await generateHMAC(deviceId, user.id, expiresAt.toISOString())
  const cookieValue = `${deviceId}.${hmac}`

  // Log the action
  await supabase
    .from('audit_logs')
    .insert({
      user_id: user.id,
      event_type: 'trusted_device_added',
      details: { device_id: deviceId, ip: clientIP },
      ip_address: clientIP,
      user_agent: userAgent
    })

  // Determine if we're in development or production for cookie settings
  const isProduction = Deno.env.get('SUPABASE_URL')?.includes('supabase.co') ?? false
  const cookieSettings = isProduction 
    ? `td=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/; Domain=.timehatch.app`
    : `td=${cookieValue}; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`

  console.log(`Setting trusted device cookie: ${isProduction ? 'production' : 'development'} mode`)

  return new Response(
    JSON.stringify({ 
      success: true, 
      device_id: deviceId,
      expires_at: expiresAt.toISOString()
    }),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Set-Cookie': cookieSettings
      } 
    }
  )
}

async function revokeTrustedDevice(supabase: any, user: any, deviceId: string) {
  const { error } = await supabase
    .from('trusted_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('device_id', deviceId)

  if (error) {
    throw new Error('Failed to revoke trusted device')
  }

  // Log the action
  await supabase
    .from('audit_logs')
    .insert({
      user_id: user.id,
      event_type: 'trusted_device_revoked',
      details: { device_id: deviceId }
    })

  // Clear cookie with proper domain settings
  const isProduction = Deno.env.get('SUPABASE_URL')?.includes('supabase.co') ?? false
  const clearCookieSettings = isProduction 
    ? `td=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/; Domain=.timehatch.app`
    : `td=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`

  return new Response(
    JSON.stringify({ success: true }),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Set-Cookie': clearCookieSettings
      } 
    }
  )
}

async function revokeAllTrustedDevices(supabase: any, user: any) {
  const { error } = await supabase
    .from('trusted_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (error) {
    throw new Error('Failed to revoke all trusted devices')
  }

  // Log the action
  await supabase
    .from('audit_logs')
    .insert({
      user_id: user.id,
      event_type: 'all_trusted_devices_revoked',
      details: {}
    })

  // Clear cookie with proper domain settings
  const isProduction = Deno.env.get('SUPABASE_URL')?.includes('supabase.co') ?? false
  const clearCookieSettings = isProduction 
    ? `td=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/; Domain=.timehatch.app`
    : `td=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`

  return new Response(
    JSON.stringify({ success: true }),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Set-Cookie': clearCookieSettings
      } 
    }
  )
}

// Utility functions
async function generateHMAC(deviceId: string, userId: string, expiresAt: string): Promise<string> {
  const message = `${deviceId}|${userId}|${expiresAt}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(HMAC_SECRET)
  const messageData = encoder.encode(message)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16) // Truncate to 16 chars for cookie size
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function getIPPrefix(ip: string): string {
  // Handle both IPv4 and IPv6
  if (ip.includes(':')) {
    // IPv6 - use /56 prefix
    const parts = ip.split(':')
    return parts.slice(0, 4).join(':') + '::'
  } else {
    // IPv4 - use /24 prefix
    const parts = ip.split('.')
    return parts.slice(0, 3).join('.') + '.0'
  }
}

function calculateUASimilarity(ua1: string, ua2Hash: string): number {
  // Simple similarity check - in production you might want something more sophisticated
  // For now, just check if major browser and version info is similar
  const getBrowserInfo = (ua: string) => {
    const chrome = ua.match(/Chrome\/(\d+)/)
    const firefox = ua.match(/Firefox\/(\d+)/)
    const safari = ua.match(/Safari\/(\d+)/)
    
    if (chrome) return `Chrome/${chrome[1].substring(0, 2)}`
    if (firefox) return `Firefox/${firefox[1].substring(0, 2)}`
    if (safari) return `Safari/${safari[1].substring(0, 2)}`
    return 'Unknown'
  }

  // This is a simplified check - for now, be more lenient
  return 0.9
}

function parseCookie(cookieString: string, name: string): string | null {
  const cookies = cookieString.split(';')
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=')
    if (key === name) {
      return value
    }
  }
  return null
}