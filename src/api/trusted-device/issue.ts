import { supabase } from '@/integrations/supabase/client';

interface TrustedDeviceResponse {
  success: boolean;
  device_id?: string;
  expires_at?: string;
  error?: string;
}

/**
 * Issues a trusted device cookie after successful MFA verification
 * Uses existing edge function for proper server-side cookie handling
 */
export async function issueTrustedDevice(): Promise<TrustedDeviceResponse> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No active session');
    }

    if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
      console.info('[trusted-device-api] === ISSUING TRUSTED DEVICE ===', {
        userId: sessionData.session.user?.id,
        currentCookies: document.cookie.substring(0, 100) + '...',
        userAgent: navigator.userAgent.substring(0, 50) + '...'
      });
    }

    // Call the existing edge function for proper server-side cookie handling
    const response = await fetch(`https://ollbuhgghkporvzmrzau.supabase.co/functions/v1/trusted-device`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbGJ1aGdnaGtwb3J2em1yemF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjU5MjksImV4cCI6MjA3MTUwMTkyOX0.6IRGOQDfUgnZgK6idaFYH_rueGFhY7-KFG5ZwvDfsdw',
      },
      body: JSON.stringify({ action: 'add' })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const responseData = await response.json();
    
    if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
      // Wait a moment for cookies to be set by browser
      setTimeout(() => {
        const updatedCookies = document.cookie;
        const hasTrustedDeviceCookie = updatedCookies.includes('th_td=');
        console.info('[trusted-device-api] === TRUSTED DEVICE ISSUED ===', {
          success: responseData.success,
          device_id: responseData.device_id?.substring(0, 8) + '...',
          expires_at: responseData.expires_at,
          cookies_before: document.cookie.includes('th_td='),
          cookies_after: hasTrustedDeviceCookie,
          updated_cookies: updatedCookies.substring(0, 150) + '...'
        });
      }, 100);
    }
    
    return {
      success: true,
      device_id: responseData.device_id,
      expires_at: responseData.expires_at
    };

  } catch (error) {
    console.error('Error issuing trusted device:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Validates trusted device cookie on the client side
 * Full validation is done server-side in the middleware
 */
export function validateTrustedCookieClient(): boolean {
  // Check if th_td cookie exists
  const cookies = document.cookie.split(';');
  const trustedDeviceCookie = cookies.find(cookie => 
    cookie.trim().startsWith('th_td=')
  );

  if (!trustedDeviceCookie) {
    return false;
  }

  // Extract token value
  const token = trustedDeviceCookie.split('=')[1]?.trim();
  
  // Basic validation - token should be reasonable length
  if (!token || token.length < 16) {
    return false;
  }

  return true;
}

/**
 * Clears the trusted device cookie with proper domain settings
 */
export function clearTrustedDeviceCookie(): void {
  const isDev = window.location.hostname.includes('lovable.dev') || window.location.hostname === 'localhost';
  const isProd = window.location.hostname.includes('timehatch.app');
  
  // Clear cookie with same domain/path settings as when it was set
  let cookieString = 'th_td=; Path=/; Max-Age=0; SameSite=Lax';
  
  if (isProd) {
    cookieString += '; Domain=.timehatch.app; Secure';
  } else if (!isDev) {
    cookieString += '; Secure';
  }
  
  document.cookie = cookieString;
  
  if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
    console.debug('[trusted-device] Cookie cleared with settings:', cookieString);
  }
}