declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'consent' | 'event' | 'js' | 'set',
      targetId?: string | Date,
      config?: any
    ) => void;
    dataLayer?: any[];
  }
}

export {};