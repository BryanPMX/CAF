// admin-portal/src/app/lib/version.ts
// Version information for debugging and consistency checks

export const APP_VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();
export const DOMAIN_CHECK = typeof window !== 'undefined' ? window.location.hostname : 'server';

// Helper function to log version info
export const logVersionInfo = () => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🚀 CAF Admin Portal Version Info:', {
      version: APP_VERSION,
      buildDate: BUILD_DATE,
      domain: DOMAIN_CHECK,
      userAgent: navigator.userAgent,
    });
  }
};

// Helper function to check if we're on the correct domain
export const isCorrectDomain = () => {
  if (typeof window === 'undefined') return true;
  
  const hostname = window.location.hostname;
  return hostname.includes('caf-mexico.org') || hostname.includes('caf-mexico.com');
};
