// admin-portal/src/core/config.ts

// Configuration management with environment variable support
export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  auth: {
    tokenKey: string;
    refreshThreshold: number; // minutes before expiry to refresh
  };
  ui: {
    pageSize: number;
    dateFormat: string;
    timeFormat: string;
  };
  features: {
    enableWebSocket: boolean;
    enableNotifications: boolean;
    enableAnalytics: boolean;
  };
}

// Environment-based configuration
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || process.env[`REACT_APP_${key}`] || defaultValue;
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value!;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key] || process.env[`REACT_APP_${key}`];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key] || process.env[`REACT_APP_${key}`];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

// Configuration object
export const config: AppConfig = {
  api: {
    baseUrl: getEnvVar('API_BASE_URL', '/api/v1'),
    timeout: getEnvNumber('API_TIMEOUT', 10000),
    retries: getEnvNumber('API_RETRIES', 3),
  },
  auth: {
    tokenKey: getEnvVar('AUTH_TOKEN_KEY', 'authToken'),
    refreshThreshold: getEnvNumber('AUTH_REFRESH_THRESHOLD', 5),
  },
  ui: {
    pageSize: getEnvNumber('UI_PAGE_SIZE', 20),
    dateFormat: getEnvVar('UI_DATE_FORMAT', 'DD/MM/YYYY'),
    timeFormat: getEnvVar('UI_TIME_FORMAT', 'HH:mm'),
  },
  features: {
    enableWebSocket: getEnvBoolean('ENABLE_WEBSOCKET', true),
    enableNotifications: getEnvBoolean('ENABLE_NOTIFICATIONS', true),
    enableAnalytics: getEnvBoolean('ENABLE_ANALYTICS', false),
  },
};

// Configuration validation
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.api.baseUrl) {
    errors.push('API base URL is required');
  }

  if (config.api.timeout <= 0) {
    errors.push('API timeout must be greater than 0');
  }

  if (config.auth.refreshThreshold < 0) {
    errors.push('Auth refresh threshold cannot be negative');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Initialize configuration
validateConfig();

// Constants derived from configuration
export const API_BASE_URL = config.api.baseUrl;
export const API_TIMEOUT = config.api.timeout;
export const PAGE_SIZE = config.ui.pageSize;
export const DATE_FORMAT = config.ui.dateFormat;
export const TIME_FORMAT = config.ui.timeFormat;

// Feature flags
export const ENABLE_WEBSOCKET = config.features.enableWebSocket;
export const ENABLE_NOTIFICATIONS = config.features.enableNotifications;
export const ENABLE_ANALYTICS = config.features.enableAnalytics;

// Business constants
export const USER_ROLES = [
  'admin',
  'office_manager',
  'lawyer',
  'psychologist',
  'receptionist',
  'event_coordinator',
  'client',
] as const;

export const CASE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const CASE_STATUSES = ['open', 'active', 'in_progress', 'resolved', 'closed', 'completed'] as const;
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;

export const CASE_CATEGORIES = [
  'civil',
  'criminal',
  'family',
  'labor',
  'administrative',
  'other',
] as const;

// Type helpers
export type UserRole = typeof USER_ROLES[number];
export type CasePriority = typeof CASE_PRIORITIES[number];
export type CaseStatus = typeof CASE_STATUSES[number];
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];
export type CaseCategory = typeof CASE_CATEGORIES[number];

// Permission checking functions
export function canAccessAllOffices(role: string): boolean {
  return role === 'admin';
}

export function isAdminRole(role: string): boolean {
  return role === 'admin';
}

export function isManagementRole(role: string): boolean {
  return ['admin', 'office_manager'].includes(role);
}

export function isStaffRole(role: string): boolean {
  return ['lawyer', 'psychologist', 'receptionist', 'event_coordinator'].includes(role);
}

export function hasPermission(role: string, permission: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    admin: ['*'], // All permissions
    office_manager: [
      'read_cases',
      'read_appointments',
      'read_users',
      'read_offices',
      'create_cases',
      'create_appointments',
      'update_cases',
      'update_appointments',
      'manage_office_users',
    ],
    lawyer: [
      'read_assigned_cases',
      'read_assigned_appointments',
      'update_assigned_cases',
      'update_assigned_appointments',
      'create_case_notes',
    ],
    psychologist: [
      'read_assigned_cases',
      'read_assigned_appointments',
      'update_assigned_cases',
      'update_assigned_appointments',
      'create_case_notes',
    ],
    receptionist: [
      'read_cases',
      'read_appointments',
      'create_appointments',
      'update_appointments',
      'read_clients',
    ],
    event_coordinator: [
      'read_appointments',
      'create_appointments',
      'update_appointments',
      'manage_events',
    ],
    client: [
      'read_own_cases',
      'read_own_appointments',
      'create_appointments',
    ],
  };

  const permissions = rolePermissions[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}
