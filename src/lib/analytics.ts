// Google Analytics utility functions
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// Analytics events
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Page view tracking
export const trackPageView = (path: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-FR7BLPXQRQ', {
      page_path: path,
      page_title: title,
    });
  }
};

// User authentication events
export const trackAuth = {
  signUp: (method: 'email' | 'google') => {
    trackEvent('sign_up', 'auth', method);
  },
  signIn: (method: 'email' | 'google') => {
    trackEvent('login', 'auth', method);
  },
  signOut: () => {
    trackEvent('sign_out', 'auth');
  },
  mfaSetup: () => {
    trackEvent('mfa_setup', 'security');
  },
  mfaVerify: (method: 'totp' | 'recovery') => {
    trackEvent('mfa_verify', 'security', method);
  },
};

// Timer events
export const trackTimer = {
  start: (projectId?: string, clientId?: string) => {
    trackEvent('timer_start', 'time_tracking', projectId ? 'with_project' : 'no_project');
  },
  stop: (duration: number, projectId?: string) => {
    trackEvent('timer_stop', 'time_tracking', projectId ? 'with_project' : 'no_project', duration);
  },
  manualEntry: () => {
    trackEvent('manual_entry', 'time_tracking');
  },
};

// Project/Client management
export const trackManagement = {
  createProject: () => {
    trackEvent('create_project', 'management');
  },
  createClient: () => {
    trackEvent('create_client', 'management');
  },
  exportData: (format: 'csv' | 'pdf') => {
    trackEvent('export_data', 'management', format);
  },
};

// Subscription events
export const trackSubscription = {
  upgrade: (plan: string) => {
    trackEvent('subscription_upgrade', 'billing', plan);
  },
  cancel: () => {
    trackEvent('subscription_cancel', 'billing');
  },
  resume: () => {
    trackEvent('subscription_resume', 'billing');
  },
};

// Error tracking
export const trackError = (error: string, context?: string) => {
  trackEvent('error', 'system', context, undefined);
  
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'exception', {
      description: error,
      fatal: false,
    });
  }
};

// Custom conversion events
export const trackConversion = {
  waitlistSignup: () => {
    trackEvent('waitlist_signup', 'conversion');
  },
  firstTimeEntry: () => {
    trackEvent('first_time_entry', 'conversion');
  },
  firstProject: () => {
    trackEvent('first_project', 'conversion');
  },
  firstExport: () => {
    trackEvent('first_export', 'conversion');
  },
};