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

    // Enhanced JSON parsing with debugging
    console.error('[trusted-device] === RAW REQUEST DEBUG ===', {
      method: req.method,
      contentType: req.headers.get('content-type'),
      hasBody: req.body !== null,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

    let body: any = {};
    let action = 'check'; // Default action
    let device_id: string | undefined;

    // Robust JSON parsing with fallback
    try {
      const rawBody = await req.text(); // Get as text first for debugging
      console.error('[trusted-device] === RAW BODY ===', {
        bodyLength: rawBody.length,
        bodyContent: rawBody || '(empty)',
        isEmptyString: rawBody === '',
        isNull: rawBody === null,
        isUndefined: rawBody === undefined
      });

      if (rawBody && rawBody.trim() !== '') {
        body = JSON.parse(rawBody);
        console.error('[trusted-device] === JSON PARSED SUCCESSFULLY ===', body);
        action = body.action || 'check';
        device_id = body.device_id;
      } else {
        console.error('[trusted-device] === EMPTY BODY - USING DEFAULTS ===');
        // For empty body, default to check action
        body = { action: 'check' };
        action = 'check';
      }
    } catch (jsonError: any) {
      console.error('[trusted-device] === JSON PARSING FAILED ===', {
        error: jsonError.message,
        bodyReceived: await req.text().catch(() => 'could-not-read-again')
      });
      
      // Fallback to check action if JSON parsing fails
      body = { action: 'check' };
      action = 'check';
    }
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    const debugAuth = Deno.env.get('NEXT_PUBLIC_DEBUG_AUTH') === 'true';
    
    // Enhanced cookie debugging
    const allCookies = req.headers.get('cookie') || '';
    const cookieDebugInfo = {
      hasCookieHeader: !!allCookies,
      cookieHeaderLength: allCookies.length,
      cookieString: allCookies ? allCookies.substring(0, 200) + (allCookies.length > 200 ? '...' : '') : 'none',
      containsThTd: allCookies.includes('th_td'),
      allCookieNames: allCookies.split(';').map(c => c.trim().split('=')[0]).filter(n => n)
    };
    
    // Use console.error for critical debugging to ensure visibility in Supabase Analytics
    if (debugAuth) {
      console.error(`[trusted-device] === DEBUGGING ACTION: ${action} for user: ${user.id} ===`);
      console.error(`[trusted-device] Request details:`, {
        clientIP,
        userAgent: userAgent.substring(0, 50) + '...',
        ...cookieDebugInfo
      });
    }

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
  const debugAuth = Deno.env.get('NEXT_PUBLIC_DEBUG_AUTH') === 'true';
  
  // Get trusted device cookie
  const cookies = req.headers.get('cookie') || ''
  const trustedDeviceCookie = parseCookie(cookies, 'th_td')
  
  if (debugAuth) {
    console.error('[trusted-device] === COOKIE PARSING DETAILS ===', {
      cookiesReceived: !!cookies,
      cookieString: cookies ? cookies.substring(0, 200) + (cookies.length > 200 ? '...' : '') : 'none',
      trustedDeviceCookie: trustedDeviceCookie ? `${trustedDeviceCookie.substring(0, 10)}...` : 'none',
      cookiePresent: !!trustedDeviceCookie,
      parsedFromCookies: cookies ? cookies.split(';').map(c => {
        const [key, val] = c.trim().split('=');
        return { key, hasValue: !!val, valueLength: val?.length || 0 };
      }) : []
    });
  }
  
  if (!trustedDeviceCookie) {
    if (debugAuth) {
      console.error('[trusted-device] === COOKIE NOT FOUND ===');
      console.error('[trusted-device] Available cookies:', cookies.split(';').map(c => c.trim()).filter(c => c));
      console.error('[trusted-device] Looking for cookie named: th_td');
    }
    return new Response(
      JSON.stringify({ 
        is_trusted: false, 
        reason: 'no_cookie',
        debug_info: debugAuth ? { 
          cookie_header_present: !!cookies,
          cookies_available: cookies.split(';').map(c => c.trim().split('=')[0]).filter(n => n)
        } : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Parse cookie: format is device_id.hmac
  const [deviceId, hmac] = trustedDeviceCookie.split('.')
  if (!deviceId || !hmac) {
    if (debugAuth) {
      console.error('[trusted-device] === INVALID COOKIE FORMAT ===', { 
        cookieValue: trustedDeviceCookie,
        deviceId: !!deviceId, 
        hmac: !!hmac,
        splitResult: trustedDeviceCookie.split('.')
      });
    }
    return new Response(
      JSON.stringify({ 
        is_trusted: false, 
        reason: 'invalid_cookie_format',
        debug_info: debugAuth ? { 
          cookie_value: trustedDeviceCookie,
          split_parts: trustedDeviceCookie.split('.').length
        } : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (debugAuth) {
    console.error('[trusted-device] === COOKIE PARSED SUCCESSFULLY ===', {
      deviceId: deviceId.substring(0, 8) + '...',
      hmacLength: hmac.length,
      userId: user.id
    });
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
    if (debugAuth) {
      console.error('[trusted-device] === DEVICE LOOKUP FAILED ===', {
        error: error?.message,
        errorCode: error?.code,
        deviceFound: !!device,
        deviceId: deviceId.substring(0, 8) + '...',
        userId: user.id,
        queryFilters: {
          user_id: user.id,
          device_id: deviceId,
          revoked_at_is_null: true,
          expires_at_gt: new Date().toISOString()
        }
      });
    }
    return new Response(
      JSON.stringify({ 
        is_trusted: false, 
        reason: error ? 'db_error' : 'device_not_found',
        details: debugAuth ? error?.message : undefined,
        debug_info: debugAuth ? {
          device_id_searched: deviceId.substring(0, 8) + '...',
          user_id: user.id,
          current_time: new Date().toISOString()
        } : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (debugAuth) {
    console.error('[trusted-device] === DEVICE FOUND IN DATABASE ===', {
      deviceId: device.device_id.substring(0, 8) + '...',
      expiresAt: device.expires_at,
      lastSeen: device.last_seen_at,
      isRevoked: !!device.revoked_at,
      isExpired: new Date(device.expires_at) < new Date()
    });
  }

  // Validate HMAC
  const expectedHmac = await generateHMAC(deviceId, user.id, device.expires_at)
  if (hmac !== expectedHmac) {
    if (debugAuth) {
      console.error('[trusted-device] === HMAC VALIDATION FAILED ===', {
        provided: hmac.substring(0, 8) + '...',
        expected: expectedHmac.substring(0, 8) + '...',
        deviceId: deviceId.substring(0, 8) + '...',
        providedLength: hmac.length,
        expectedLength: expectedHmac.length,
        hmacMessage: `${deviceId}|${user.id}|${device.expires_at}`
      });
    }
    return new Response(
      JSON.stringify({ 
        is_trusted: false, 
        reason: 'invalid_hmac',
        debug_info: debugAuth ? {
          expected_hmac_length: expectedHmac.length,
          provided_hmac_length: hmac.length
        } : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (debugAuth) {
    console.error('[trusted-device] === HMAC VALIDATION SUCCESSFUL ===');
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

  if (debugAuth) {
    console.error('[trusted-device] === DEVICE SUCCESSFULLY VALIDATED AS TRUSTED ===', {
      deviceId: deviceId.substring(0, 8) + '...',
      expiresAt: device.expires_at,
      userId: user.id,
      lastSeenUpdated: true
    });
  }

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
  
  // Development-friendly cookie settings (no Secure flag for localhost)
  const cookieSettings = isProduction 
    ? `th_td=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/; Domain=.timehatch.app`
    : `th_td=${cookieValue}; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`
  
  // Add debug cookie (non-HttpOnly) so we can verify in browser
  const debugCookieSettings = isProduction 
    ? `th_td_debug=${deviceId.substring(0, 8)}; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/; Domain=.timehatch.app`
    : `th_td_debug=${deviceId.substring(0, 8)}; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`

  if (Deno.env.get('NEXT_PUBLIC_DEBUG_AUTH') === 'true') {
    console.error('[trusted-device] === SETTING COOKIES ===', {
      mode: isProduction ? 'production' : 'development',
      cookieValue: deviceId.substring(0, 8) + '...',
      httpOnlyCookie: cookieSettings,
      debugCookie: debugCookieSettings
    })
  }

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
        // Set both HttpOnly and debug cookies
        'Set-Cookie': [cookieSettings, debugCookieSettings]
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
    ? `th_td=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/; Domain=.timehatch.app`
    : `th_td=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`

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
    ? `th_td=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/; Domain=.timehatch.app`
    : `th_td=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`

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