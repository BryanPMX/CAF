// admin-portal/src/app/lib/api-endpoints.ts
// Role-based API endpoint configuration

import { UserRole } from './types';

// API endpoint mappings based on user roles
export const API_ENDPOINTS = {
  cases: {
    // Admin endpoints (optimized for performance)
    admin: {
      list: '/admin/optimized/cases',
      create: '/admin/cases',
      get: (id: string) => `/admin/cases/${id}`,
      update: (id: string) => `/admin/cases/${id}`,
      delete: (id: string) => `/admin/cases/${id}`,
      assign: (id: string) => `/admin/cases/${id}/assign`,
    },
    // Staff endpoints (standard CRUD with access control)
    staff: {
      list: '/staff/cases',
      create: '/staff/cases',
      get: (id: string) => `/staff/cases/${id}`,
      update: (id: string) => `/staff/cases/${id}`,
      delete: (id: string) => `/staff/cases/${id}`,
      my: '/staff/cases/my',
    },
    // Manager endpoints
    manager: {
      list: '/manager/cases',
      create: '/manager/cases',
      get: (id: string) => `/manager/cases/${id}`,
      update: (id: string) => `/manager/cases/${id}`,
      delete: (id: string) => `/manager/cases/${id}`,
    },
  },
  appointments: {
    admin: {
      list: '/admin/optimized/appointments',
      create: '/admin/appointments',
      get: (id: string) => `/admin/appointments/${id}`,
      update: (id: string) => `/admin/appointments/${id}`,
      delete: (id: string) => `/admin/appointments/${id}`,
    },
    staff: {
      list: '/staff/appointments',
      create: '/staff/appointments',
      get: (id: string) => `/staff/appointments/${id}`,
      update: (id: string) => `/staff/appointments/${id}`,
      delete: (id: string) => `/staff/appointments/${id}`,
      my: '/staff/appointments/my',
    },
    manager: {
      list: '/manager/appointments',
      create: '/manager/appointments',
      get: (id: string) => `/manager/appointments/${id}`,
      update: (id: string) => `/manager/appointments/${id}`,
      delete: (id: string) => `/manager/appointments/${id}`,
    },
  },
  users: {
    admin: {
      list: '/admin/optimized/users',
      create: '/admin/users',
      get: (id: string) => `/admin/users/${id}`,
      update: (id: string) => `/admin/users/${id}`,
      delete: (id: string) => `/admin/users/${id}`,
    },
    manager: {
      list: '/manager/users',
      create: '/manager/users',
      get: (id: string) => `/manager/users/${id}`,
      update: (id: string) => `/manager/users/${id}`,
      delete: (id: string) => `/manager/users/${id}`,
    },
  },
  tasks: {
    admin: {
      list: '/admin/tasks',
      create: '/admin/tasks',
      get: (id: string) => `/admin/tasks/${id}`,
      update: (id: string) => `/admin/tasks/${id}`,
      delete: (id: string) => `/admin/tasks/${id}`,
    },
    staff: {
      list: '/staff/tasks',
      create: '/staff/tasks',
      get: (id: string) => `/staff/tasks/${id}`,
      update: (id: string) => `/staff/tasks/${id}`,
      delete: (id: string) => `/staff/tasks/${id}`,
      my: '/staff/tasks/my',
    },
  },
} as const;

// Role hierarchy for determining access level
const ROLE_HIERARCHY = {
  admin: 1,
  office_manager: 2,
  lawyer: 3,
  psychologist: 3,
  receptionist: 4,
  event_coordinator: 5,
  client: 6,
} as const;

// Determine which endpoint group to use based on user role
export function getEndpointGroup(role: UserRole): 'admin' | 'staff' | 'manager' {
  const hierarchyLevel = ROLE_HIERARCHY[role];
  
  if (hierarchyLevel <= 1) {
    return 'admin';
  } else if (hierarchyLevel <= 2) {
    return 'manager';
  } else {
    return 'staff';
  }
}

// Get appropriate API endpoints for a user role
export function getApiEndpoints(role: UserRole) {
  const endpointGroup = getEndpointGroup(role);
  
  return {
    cases: API_ENDPOINTS.cases[endpointGroup],
    appointments: API_ENDPOINTS.appointments[endpointGroup],
    users: API_ENDPOINTS.users[endpointGroup as keyof typeof API_ENDPOINTS.users],
    tasks: API_ENDPOINTS.tasks[endpointGroup as keyof typeof API_ENDPOINTS.tasks],
  };
}

// Helper function to get cases endpoint based on role
export function getCasesEndpoint(role: UserRole, action: keyof typeof API_ENDPOINTS.cases.admin = 'list', id?: string) {
  const endpoints = getApiEndpoints(role).cases;
  
  switch (action) {
    case 'list':
      return endpoints.list;
    case 'create':
      return endpoints.create;
    case 'get':
      return id ? endpoints.get(id) : endpoints.list;
    case 'update':
      return id ? endpoints.update(id) : endpoints.create;
    case 'delete':
      return id ? endpoints.delete(id) : endpoints.list;
    default:
      return endpoints.list;
  }
}

// Helper function to get appointments endpoint based on role
export function getAppointmentsEndpoint(role: UserRole, action: keyof typeof API_ENDPOINTS.appointments.admin = 'list', id?: string) {
  const endpoints = getApiEndpoints(role).appointments;
  
  switch (action) {
    case 'list':
      return endpoints.list;
    case 'create':
      return endpoints.create;
    case 'get':
      return id ? endpoints.get(id) : endpoints.list;
    case 'update':
      return id ? endpoints.update(id) : endpoints.create;
    case 'delete':
      return id ? endpoints.delete(id) : endpoints.list;
    default:
      return endpoints.list;
  }
}

// Check if user role has access to a specific resource
export function hasResourceAccess(role: UserRole, resource: 'cases' | 'appointments' | 'users' | 'tasks', action: 'create' | 'read' | 'update' | 'delete' = 'read'): boolean {
  const hierarchyLevel = ROLE_HIERARCHY[role];
  
  // Admin has access to everything
  if (hierarchyLevel <= 1) {
    return true;
  }
  
  // Manager has access to most resources
  if (hierarchyLevel <= 2) {
    return resource !== 'users' || action === 'read';
  }
  
  // Staff roles have limited access
  switch (resource) {
    case 'cases':
    case 'appointments':
    case 'tasks':
      return true; // Staff can access their own cases, appointments, and tasks
    case 'users':
      return false; // Staff cannot manage users
    default:
      return false;
  }
}

// Check if user role can access admin endpoints
export function canAccessAdminEndpoints(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] <= 1;
}

// Check if user role can access manager endpoints
export function canAccessManagerEndpoints(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] <= 2;
}

// Check if user role can access staff endpoints
export function canAccessStaffEndpoints(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] <= 5;
}
