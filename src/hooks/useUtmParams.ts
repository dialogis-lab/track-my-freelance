import { useState, useEffect } from 'react';

interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export const useUtmParams = () => {
  const [utmParams, setUtmParams] = useState<UtmParams>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const params: UtmParams = {
        source: urlParams.get('utm_source') || undefined,
        medium: urlParams.get('utm_medium') || undefined,
        campaign: urlParams.get('utm_campaign') || undefined,
        term: urlParams.get('utm_term') || undefined,
        content: urlParams.get('utm_content') || undefined,
      };
      
      // Only set if at least one UTM param exists
      if (Object.values(params).some(value => value)) {
        setUtmParams(params);
      }
    }
  }, []);

  return utmParams;
};