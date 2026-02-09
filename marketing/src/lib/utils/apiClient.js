// marketing/src/lib/utils/apiClient.js
// API client with comprehensive error handling for the marketing site

import { errorHandler } from './errorHandler.js';
import { config } from '$lib/config.js';

class ApiClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.timeout = 10000; // 10 seconds
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = await response.text();
        throw error;
      }

      const data = await response.json();
      return { success: true, data };

    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error('La solicitud tardó demasiado tiempo');
        timeoutError.type = 'timeout';
        return errorHandler.handleApiError(timeoutError, endpoint);
      }

      return errorHandler.handleApiError(error, endpoint);
    }
  }

  // GET request
  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  // POST request
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  }

  // PUT request
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    });
  }

  // DELETE request
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return response.success;
    } catch (error) {
      console.warn('Health check failed:', error);
      return false;
    }
  }
}

// Create API client instances
export const apiClient = new ApiClient();
export const contactApiClient = new ApiClient('/api/contact');
export const newsletterApiClient = new ApiClient('/api/newsletter');

// Utility functions for common API operations
export const apiUtils = {
  // Submit contact form
  async submitContactForm(formData) {
    try {
      const response = await contactApiClient.post('/submit', formData);
      if (response.success) {
        errorHandler.showNotification('¡Mensaje enviado correctamente! Nos pondremos en contacto pronto.', 'success');
        return true;
      }
      return false;
    } catch (error) {
      errorHandler.handleApiError(error, 'contact_form');
      return false;
    }
  },

  // Subscribe to newsletter
  async subscribeNewsletter(email) {
    try {
      const response = await newsletterApiClient.post('/subscribe', { email });
      if (response.success) {
        errorHandler.showNotification('¡Te has suscrito correctamente a nuestro boletín!', 'success');
        return true;
      }
      return false;
    } catch (error) {
      errorHandler.handleApiError(error, 'newsletter_subscription');
      return false;
    }
  },

  // Check API connectivity
  async checkConnectivity() {
    try {
      const isHealthy = await apiClient.healthCheck();
      if (!isHealthy) {
        console.warn('API connectivity issues detected');
      }
      return isHealthy;
    } catch (error) {
      console.warn('API connectivity check failed:', error);
      return false;
    }
  },

  // Fetch public offices for the contact page map (from GET /api/v1/public/offices)
  async fetchOffices() {
    const base = config?.api?.baseUrl || '';
    if (!base) {
      console.warn('VITE_API_URL not configured');
      return [];
    }
    const client = new ApiClient(base);
    const result = await client.get('/public/offices');
    if (result && result.success && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  }
};
