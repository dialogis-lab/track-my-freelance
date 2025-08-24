import { useState, useEffect } from 'react';

export interface CookieConsent {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentState {
  consent: CookieConsent;
  hasConsented: boolean;
  showBanner: boolean;
  showModal: boolean;
}

const DEFAULT_CONSENT: CookieConsent = {
  functional: true, // Always required
  analytics: false,
  marketing: false,
};

const STORAGE_KEY = 'cookieConsent';

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent>(DEFAULT_CONSENT);
  const [hasConsented, setHasConsented] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      console.log('Stored consent:', stored);
      if (stored) {
        const parsedConsent = JSON.parse(stored);
        setConsent({ ...DEFAULT_CONSENT, ...parsedConsent });
        setHasConsented(true);
        setShowBanner(false);
        console.log('Loaded consent from storage:', parsedConsent);
      } else {
        // First visit - show banner
        console.log('No stored consent, showing banner');
        setShowBanner(true);
      }
    } catch (error) {
      console.error('Error loading cookie consent:', error);
      setShowBanner(true);
    }
  }, []);

  // Save consent to localStorage
  const saveConsent = (newConsent: CookieConsent) => {
    try {
      const consentToSave = { ...newConsent, functional: true }; // Functional always true
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentToSave));
      setConsent(consentToSave);
      setHasConsented(true);
      setShowBanner(false);
      setShowModal(false);
      
      // Update Google Analytics consent based on user choice
      if (window.gtag) {
        window.gtag('consent', 'update', {
          analytics_storage: consentToSave.analytics ? 'granted' : 'denied',
          ad_storage: consentToSave.marketing ? 'granted' : 'denied',
        });
      }
      
      console.log('Cookie consent saved:', consentToSave);
    } catch (error) {
      console.error('Error saving cookie consent:', error);
    }
  };

  const acceptAll = () => {
    saveConsent({
      functional: true,
      analytics: true,
      marketing: true,
    });
  };

  const rejectNonEssential = () => {
    saveConsent({
      functional: true,
      analytics: false,
      marketing: false,
    });
  };

  const updateConsent = (newConsent: Partial<CookieConsent>) => {
    const updatedConsent = { ...consent, ...newConsent, functional: true };
    saveConsent(updatedConsent);
  };

  const openModal = () => {
    console.log('Opening cookie modal');
    setShowModal(true);
    setShowBanner(false);
  };

  const closeModal = () => {
    setShowModal(false);
    if (!hasConsented) {
      setShowBanner(true);
    }
  };

  const resetConsent = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConsent(DEFAULT_CONSENT);
    setHasConsented(false);
    setShowBanner(true);
    setShowModal(false);
  };

  return {
    consent,
    hasConsented,
    showBanner,
    showModal,
    acceptAll,
    rejectNonEssential,
    updateConsent,
    openModal,
    closeModal,
    resetConsent,
  };
}