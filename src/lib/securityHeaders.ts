/**
 * HTTP Security Headers configuration for TimeHatch
 * These headers provide defense-in-depth against various web vulnerabilities
 */

export const securityHeaders: [string, string][] = [
  // HSTS - Force HTTPS for 1 year including subdomains
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"],
  
  // Referrer Policy - Only send referrer to same origin
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  
  // Content Type Options - Prevent MIME sniffing
  ["X-Content-Type-Options", "nosniff"],
  
  // Frame Options - Prevent embedding in frames
  ["X-Frame-Options", "DENY"],
  
  // XSS Protection - Enable browser XSS filtering
  ["X-XSS-Protection", "1; mode=block"],
  
  // Permissions Policy - Limit dangerous features
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), fullscreen=(self)"],
  
  // Content Security Policy - Restrict resource loading
  ["Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' https://*.supabase.co https://api.resend.com https://www.google-analytics.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'"
  ]
];

/**
 * Apply security headers to a Response object
 */
export function applySecurityHeaders(response: Response): Response {
  securityHeaders.forEach(([name, value]) => {
    response.headers.set(name, value);
  });
  return response;
}

/**
 * Create a Response with security headers pre-applied
 */
export function createSecureResponse(
  body?: BodyInit | null, 
  init?: ResponseInit
): Response {
  const response = new Response(body, init);
  return applySecurityHeaders(response);
}

/**
 * Get security headers as an object (useful for frameworks)
 */
export function getSecurityHeadersObject(): Record<string, string> {
  return Object.fromEntries(securityHeaders);
}

/**
 * Validate that security headers are present in a response
 */
export function validateSecurityHeaders(response: Response): { 
  present: string[]; 
  missing: string[]; 
  csp?: string;
} {
  const present: string[] = [];
  const missing: string[] = [];
  let csp: string | undefined;

  securityHeaders.forEach(([name, expectedValue]) => {
    const actualValue = response.headers.get(name);
    if (actualValue) {
      present.push(name);
      if (name === 'Content-Security-Policy') {
        csp = actualValue;
      }
    } else {
      missing.push(name);
    }
  });

  return { present, missing, csp };
}

/**
 * Check if the current environment supports security headers
 */
export function checkSecurityHeadersSupport(): Promise<{ 
  supported: boolean; 
  headers: { [key: string]: boolean };
  error?: string;
}> {
  return fetch(window.location.origin, { method: 'HEAD' })
    .then(response => {
      const results: { [key: string]: boolean } = {};
      
      securityHeaders.forEach(([headerName]) => {
        results[headerName] = response.headers.has(headerName.toLowerCase());
      });
      
      return {
        supported: Object.values(results).some(Boolean),
        headers: results
      };
    })
    .catch(error => ({
      supported: false,
      headers: Object.fromEntries(securityHeaders.map(([name]) => [name, false])),
      error: error.message
    }));
}