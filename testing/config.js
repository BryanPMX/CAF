#!/usr/bin/env node

/**
 * Centralized Configuration for CAF Testing Suite
 * All test files should import this configuration for consistency
 */

require('dotenv').config();

// Default configuration values
const DEFAULTS = {
  API_BASE_URL: 'http://localhost:8080/api/v1', // Default to local development
  FRONTEND_BASE_URL: 'http://localhost:3000',
  WS_BASE_URL: 'ws://localhost:8080/ws',

  // Test user credentials (development defaults)
  TEST_USER_EMAIL: 'admin@caf.org',
  TEST_USER_PASSWORD: 'admin123',
  ADMIN_TEST_EMAIL: 'admin@caf.org',
  ADMIN_TEST_PASSWORD: 'admin123',

  // Production overrides (if environment variables are set)
  PRODUCTION_API_URL: 'https://api.caf-mexico.org/api/v1',
  PRODUCTION_FRONTEND_URL: 'https://admin.caf-mexico.org',
  PRODUCTION_WS_URL: 'wss://api.caf-mexico.org/ws',

  // Test settings
  TIMEOUT: 10000,
  MAX_RETRIES: 3,
  TEST_DATA_PREFIX: 'TEST_',

  // Flags
  DRY_RUN: false,
  VERBOSE: false
};

// Environment-based configuration
const config = {
  // API endpoints - use production if explicitly set, otherwise local dev
  API_BASE_URL: process.env.API_BASE_URL ||
                (process.env.NODE_ENV === 'production' ? DEFAULTS.PRODUCTION_API_URL : DEFAULTS.API_BASE_URL),

  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL ||
                     (process.env.NODE_ENV === 'production' ? DEFAULTS.PRODUCTION_FRONTEND_URL : DEFAULTS.FRONTEND_BASE_URL),

  WS_BASE_URL: process.env.WS_BASE_URL ||
               (process.env.NODE_ENV === 'production' ? DEFAULTS.PRODUCTION_WS_URL : DEFAULTS.WS_BASE_URL),

  // Test credentials - use env vars if set, otherwise defaults
  TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || DEFAULTS.TEST_USER_EMAIL,
  TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || DEFAULTS.TEST_USER_PASSWORD,
  ADMIN_TEST_EMAIL: process.env.ADMIN_TEST_EMAIL || DEFAULTS.ADMIN_TEST_EMAIL,
  ADMIN_TEST_PASSWORD: process.env.ADMIN_TEST_PASSWORD || DEFAULTS.ADMIN_TEST_PASSWORD,

  // Test settings
  TIMEOUT: parseInt(process.env.TIMEOUT) || DEFAULTS.TIMEOUT,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || DEFAULTS.MAX_RETRIES,
  TEST_DATA_PREFIX: process.env.TEST_DATA_PREFIX || DEFAULTS.TEST_DATA_PREFIX,

  // Flags
  DRY_RUN: process.env.DRY_RUN === 'true' || DEFAULTS.DRY_RUN,
  VERBOSE: process.env.VERBOSE === 'true' || DEFAULTS.VERBOSE,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Test user objects for convenience
config.TEST_USERS = {
  admin: {
    email: config.ADMIN_TEST_EMAIL,
    password: config.ADMIN_TEST_PASSWORD,
    role: 'admin'
  },
  test: {
    email: config.TEST_USER_EMAIL,
    password: config.TEST_USER_PASSWORD,
    role: 'client' // Default role for test user
  }
};

// Validation
if (!config.API_BASE_URL) {
  throw new Error('API_BASE_URL must be configured');
}

if (!config.TEST_USER_EMAIL || !config.TEST_USER_PASSWORD) {
  throw new Error('Test user credentials must be configured');
}

module.exports = config;
