import { createContext, useContext, useEffect } from 'react';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { CookieBanner } from './CookieBanner';
import { CookieModal } from './CookieModal';

interface CookieProviderProps {
  children: React.ReactNode;
}

const CookieContext = createContext<ReturnType<typeof useCookieConsent> | null>(null);

export function CookieProvider({ children }: CookieProviderProps) {
  const cookieConsent = useCookieConsent();

  // Initialize Google Analytics consent mode
  useEffect(() => {
    if (window.gtag) {
      // Set default consent state
      window.gtag('consent', 'default', {
        analytics_storage: cookieConsent.hasConsented && cookieConsent.consent.analytics ? 'granted' : 'denied',
        ad_storage: cookieConsent.hasConsented && cookieConsent.consent.marketing ? 'granted' : 'denied',
        functionality_storage: 'granted', // Always granted for functional cookies
      });
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