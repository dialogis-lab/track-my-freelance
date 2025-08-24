// Security headers configuration for TimeHatch
// These headers should be set by the hosting provider or reverse proxy

export const SECURITY_HEADERS = {
  // HSTS - Force HTTPS for 1 year including subdomains
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Content Security Policy - Restrict resource loading
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React needs unsafe-inline and unsafe-eval
    "style-src 'self' 'unsafe-inline'", // Tailwind needs unsafe-inline
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  
  // Referrer Policy - Only send referrer to same origin
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Content Type Options - Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Frame Options - Prevent embedding in frames
  'X-Frame-Options': 'DENY',
  
  // XSS Protection - Enable browser XSS filtering
  'X-XSS-Protection': '1; mode=block',
  
  // Permissions Policy - Limit dangerous features
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'fullscreen=(self)'
  ].join(', ')
};

// Example Nginx configuration for hosting providers
export const NGINX_CONFIG_EXAMPLE = `
# Add these headers to your Nginx server block:
server {
    # ... other config

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), fullscreen=(self)" always;

    # Cookie Security (if using server-side sessions)
    # Make sure all cookies are Secure, HttpOnly, and SameSite=Lax
    proxy_cookie_flags ~ secure httponly samesite=lax;
}
`;

// Example Apache configuration
export const APACHE_CONFIG_EXAMPLE = `
# Add these directives to your Apache .htaccess or virtual host:
<IfModule mod_headers.c>
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), fullscreen=(self)"
</IfModule>
`;

// Utility function to check if security headers are properly configured
export function checkSecurityHeaders(): Promise<{ [key: string]: boolean }> {
  return fetch(window.location.origin, { method: 'HEAD' })
    .then(response => {
      const results: { [key: string]: boolean } = {};
      
      Object.keys(SECURITY_HEADERS).forEach(headerName => {
        results[headerName] = response.headers.has(headerName.toLowerCase());
      });
      
      return results;
    })
    .catch(() => {
      // If fetch fails, assume headers are not set
      const results: { [key: string]: boolean } = {};
      Object.keys(SECURITY_HEADERS).forEach(headerName => {
        results[headerName] = false;
      });
      return results;
    });
}