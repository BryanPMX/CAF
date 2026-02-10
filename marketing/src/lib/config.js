// marketing/src/lib/config.js
// Environment configuration for CAF marketing site

export const config = {
  site: {
    name: 'Centro de Apoyo para la Familia A.C.',
    url: import.meta.env.VITE_SITE_URL || 'https://caf-mexico.org',
    description: 'Brindamos apoyo legal, psicológico y social a familias vulnerables'
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'https://api.caf-mexico.com/api/v1',
    adminPortalUrl: import.meta.env.VITE_ADMIN_PORTAL_URL || 'https://admin.caf-mexico.org'
  },
  contact: {
    email: import.meta.env.VITE_CONTACT_EMAIL || 'mujer_familia@hotmail.com',
    phone: import.meta.env.VITE_CONTACT_PHONE || '+1-915-555-0123',
    address: import.meta.env.VITE_ADDRESS || 'Ciudad Juarez, Chihuahua, Mexico'
  },
  social: {
    facebook: import.meta.env.VITE_FACEBOOK_URL,
    twitter: import.meta.env.VITE_TWITTER_URL,
    instagram: import.meta.env.VITE_INSTAGRAM_URL
  }
};

// Helper function to get admin portal URL
export const getAdminPortalUrl = () => {
  return config.api.adminPortalUrl;
};

// Helper function to get API URL
export const getApiUrl = () => {
  return config.api.baseUrl;
};

// Helper function to get contact information
export const getContactInfo = () => {
  return config.contact;
};
