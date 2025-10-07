// admin-portal/src/app/lib/api.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { getApiConfig, validateConfig, isDebugMode } from './config';

// Validate configuration on module load
validateConfig();

// Extend AxiosRequestConfig to include metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  };
}

// Get API configuration
const apiConfig = getApiConfig();

// Create axios instance with centralized configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeout,
  headers: apiConfig.headers,
});

// Debug: Log the base URL being used
if (isDebugMode()) {
  console.log('🚀 API Client initialized with base URL:', apiConfig.baseURL);
}

// Request interceptor for authentication and caching
apiClient.interceptors.request.use(
  (config: ExtendedAxiosRequestConfig) => {
    // Debug: Log the full URL being requested
    if (isDebugMode()) {
      console.log('📤 Request:', {
        method: config.method?.toUpperCase(),
        url: (config.baseURL || '') + (config.url || ''),
        endpoint: config.url,
        baseURL: config.baseURL,
      });
    }
    
    
    // Add auth token if available
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and caching
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Debug: Log successful responses
    if (isDebugMode()) {
      console.log('✅ Response:', {
        status: response.status,
        url: response.config.url,
        method: response.config.method?.toUpperCase(),
      });
    }
    

    return response;
  },
  (error) => {
    // Debug: Log error details
    if (isDebugMode()) {
      console.log('❌ Request Error:', {
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        message: error.message,
        baseURL: error.config?.baseURL,
        fullURL: (error.config?.baseURL || '') + (error.config?.url || ''),
      });
    }
    

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      Cookies.remove('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Export the configured client
export { apiClient };
