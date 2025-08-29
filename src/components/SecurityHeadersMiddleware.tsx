import { useEffect } from 'react';
import { securityHeaders } from '@/lib/securityHeaders';

/**
 * Component to apply security headers via meta tags
 * Note: This is a client-side approach. For production, 
 * security headers should be set by the web server or CDN
 */
export function SecurityHeadersMiddleware() {
  useEffect(() => {
    // Apply Content Security Policy via meta tag
    const csp = securityHeaders.find(([name]) => name === 'Content-Security-Policy')?.[1];
    if (csp) {
      const metaCSP = document.createElement('meta');
      metaCSP.httpEquiv = 'Content-Security-Policy';
      metaCSP.content = csp;
      document.head.appendChild(metaCSP);
    }

    // Apply Referrer Policy
    const referrerPolicy = securityHeaders.find(([name]) => name === 'Referrer-Policy')?.[1];
    if (referrerPolicy) {
      const metaReferrer = document.createElement('meta');
      metaReferrer.name = 'referrer';
      metaReferrer.content = referrerPolicy;
      document.head.appendChild(metaReferrer);
    }

    // Note: Cookie security attributes are handled by the server/browser
    // Client-side cookie manipulation can be limited and is not always effective
    // for HttpOnly attributes. This is handled by server configuration.

    return () => {
      // Cleanup meta tags on unmount
      const metas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"], meta[name="referrer"]');
      metas.forEach(meta => meta.remove());
    };
  }, []);

  return null;
}