// admin-portal/src/lib/api.ts
import axios from 'axios';

// We create a new instance of axios with a custom configuration.
const apiClient = axios.create({
  // The base URL for all API requests. We use an environment variable
  // to make it easy to change between development and production.
  // The NEXT_PUBLIC_ prefix is required by Next.js to expose the variable to the browser.
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// We use an "interceptor" to automatically add the JWT to every outgoing request.
// This is a powerful feature that saves us from having to add the token manually on every API call.
apiClient.interceptors.request.use(
  (config) => {
    // This code runs before each request is sent.
    // We check if we're running in a browser environment.
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        // If a token exists in localStorage, add it to the Authorization header.
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    // Handle any errors that occur during request setup.
    return Promise.reject(error);
  }
);

export { apiClient };
