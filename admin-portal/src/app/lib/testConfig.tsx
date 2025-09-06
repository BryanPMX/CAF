// admin-portal/src/app/lib/testConfig.tsx
'use client';

import { useEffect } from 'react';
import { getConfig, validateConfig } from './config';
import { apiClient } from './api';

export const TestConfiguration = () => {
  useEffect(() => {
    // Test configuration on component mount
    console.log('🧪 Testing Configuration...');
    
    try {
      validateConfig();
      
      const config = getConfig();
      console.log('📋 Current Configuration:', {
        environment: config.environment,
        apiBaseURL: config.api.baseURL,
        debug: config.debug,
      });
      
      console.log('🔗 API Client Base URL:', apiClient.defaults.baseURL);
      console.log('🎯 Expected Login URL:', apiClient.defaults.baseURL + '/login');
      
      // Test API connectivity
      fetch(apiClient.defaults.baseURL + '/test')
        .then(response => response.json())
        .then(data => {
          console.log('✅ API Connectivity Test:', data);
        })
        .catch(error => {
          console.error('❌ API Connectivity Test Failed:', error);
        });
        
    } catch (error) {
      console.error('❌ Configuration Test Failed:', error);
    }
  }, []);

  return null; // This component doesn't render anything
};
