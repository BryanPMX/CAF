// admin-portal/src/app/lib/config.ts
// Centralized configuration management following SOLID principles

interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
}

interface AppConfig {
  api: ApiConfig;
  environment: 'development' | 'production' | 'test';
  debug: boolean;
}

// Environment-based configuration
const getEnvironmentConfig = (): AppConfig => {
  const environment = process.env.NODE_ENV || 'development';
  const debug = environment === 'development';

  // API Configuration
  const apiConfig: ApiConfig = {
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  return {
    api: apiConfig,
    environment: environment as 'development' | 'production' | 'test',
    debug,
  };
};

// Singleton configuration instance
let configInstance: AppConfig | null = null;

export const getConfig = (): AppConfig => {
  if (!configInstance) {
    configInstance = getEnvironmentConfig();
    
    // Debug logging in development
    if (configInstance.debug) {
      console.log('🔧 App Configuration:', {
        environment: configInstance.environment,
        apiBaseURL: configInstance.api.baseURL,
        debug: configInstance.debug,
      });
    }
  }
  
  return configInstance;
};

// Export specific config getters for better encapsulation
export const getApiConfig = (): ApiConfig => getConfig().api;
export const getEnvironment = (): string => getConfig().environment;
export const isDebugMode = (): boolean => getConfig().debug;

// Configuration validation
export const validateConfig = (): void => {
  const config = getConfig();
  
  if (!config.api.baseURL) {
    throw new Error('API base URL is not configured');
  }
  
  if (!config.api.baseURL.includes('/api/v1')) {
    console.warn('⚠️ API base URL should include /api/v1 namespace');
  }
  
  if (config.debug) {
    console.log('✅ Configuration validation passed');
  }
};
