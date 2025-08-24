import { createContext, useContext, useEffect, useRef } from 'react';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { CookieBanner } from './CookieBanner';
import { CookieModal } from './CookieModal';

interface CookieProviderProps {
  children: React.ReactNode;
}

const CookieContext = createContext<ReturnType<typeof useCookieConsent> | null>(null);

export function CookieProvider({ children }: CookieProviderProps) {
  const cookieConsent = useCookieConsent();
  const gaLoadedRef = useRef(false);

  // Initialize Google Analytics consent mode and load GA when consent is granted
  useEffect(() => {
    console.log('CookieProvider: Analytics consent changed', {
      hasConsented: cookieConsent.hasConsented,
      analytics: cookieConsent.consent.analytics,
      gaLoaded: gaLoadedRef.current
    });
    
    if (window.gtag) {
      // Update consent state
      window.gtag('consent', 'update', {
        analytics_storage: cookieConsent.hasConsented && cookieConsent.consent.analytics ? 'granted' : 'denied',
        ad_storage: cookieConsent.hasConsented && cookieConsent.consent.marketing ? 'granted' : 'denied',
      });
    }

    // Load Google Analytics if consent is granted and not already loaded
    if (cookieConsent.hasConsented && cookieConsent.consent.analytics && !gaLoadedRef.current) {
      console.log('Loading Google Analytics...');
      
      // Load GA script
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = 'https://www.googletagmanager.com/gtag/js?id=G-FR7BLXPXR0';
      document.head.appendChild(script1);

      // Initialize GA
      const script2 = document.createElement('script');
      script2.innerHTML = `
        window.gtag('js', new Date());
        window.gtag('config', 'G-FR7BLXPXR0', {
          'anonymize_ip': true,
          'cookie_flags': 'samesite=strict;secure'
        });
      `;
      document.head.appendChild(script2);
      
      gaLoadedRef.current = true;
      console.log('Google Analytics loaded successfully');
    }
  }, [cookieConsent.hasConsented, cookieConsent.consent.analytics, cookieConsent.consent.marketing]);

  return (
    <CookieContext.Provider value={cookieConsent}>
      {children}
      <CookieBanner />
      <CookieModal />
    </CookieContext.Provider>
  );
}

export function useCookieContext() {
  const context = useContext(CookieContext);
  if (!context) {
    throw new Error('useCookieContext must be used within a CookieProvider');
  }
  return context;
}