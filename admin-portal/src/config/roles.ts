/**
 * Centralized Staff Roles Configuration
 * 
 * This file serves as the single source of truth for all staff role definitions
 * across the CAF Admin Portal. It eliminates hardcoded role lists and ensures
 * consistency throughout the application.
 * 
 * @author CAF Development Team
 * @version 1.0.0
 */

// Staff role interface definition
export interface StaffRole {
  /** Machine-readable key stored in the database */
  value: string;
  /** User-friendly, formal Spanish name for the UI */
  label: string;
  /** Associated department for smart filtering and case assignment */
  department: 'legal' | 'psychology' | 'general' | 'administration';
  /** Whether this role requires office assignment */
  requiresOffice: boolean;
  /** Whether this role can manage other users */
  canManageUsers: boolean;
  /** Display color for role badges */
  color: string;
}

/**
 * Complete list of all staff roles in the CAF system
 * 
 * This array contains every single staff role defined in our architecture.
 * Adding a new role requires only updating this array, and the entire UI
 * will update automatically.
 */
export const STAFF_ROLES: StaffRole[] = [
  {
    value: 'admin',
    label: 'Administrador',
    department: 'administration',
    requiresOffice: false,
    canManageUsers: true,
    color: 'red'
  },
  {
    value: 'office_manager',
    label: 'Gerente de Oficina',
    department: 'administration',
    requiresOffice: true,
    canManageUsers: true,
    color: 'blue'
  },
  {
    value: 'lawyer',
    label: 'Abogado(a)',
    department: 'legal',
    requiresOffice: true,
    canManageUsers: false,
    color: 'volcano'
  },
  {
    value: 'psychologist',
    label: 'Psicólogo(a)',
    department: 'psychology',
    requiresOffice: true,
    canManageUsers: false,
    color: 'orange'
  },
  {
    value: 'receptionist',
    label: 'Recepcionista',
    department: 'general',
    requiresOffice: true,
    canManageUsers: false,
    color: 'geekblue'
  },
  {
    value: 'event_coordinator',
    label: 'Coordinador de Eventos',
    department: 'general',
    requiresOffice: true,
    canManageUsers: false,
    color: 'cyan'
  },
  {
    value: 'client',
    label: 'Cliente',
    department: 'general',
    requiresOffice: false,
    canManageUsers: false,
    color: 'gray'
  }
];

/**
 * Legacy role mappings for backward compatibility
 * 
 * These mappings handle variations in role names that may exist in the database
 * or API responses, ensuring smooth transitions during refactoring.
 */
export const ROLE_LABELS: { [key: string]: string } = {
  'admin': 'Administrador',
  'lawyer': 'Abogado',
  'attorney': 'Abogado',
  'senior_attorney': 'Abogado Senior',
  'paralegal': 'Paralegal',
  'associate': 'Asociado',
  'psychologist': 'Psicólogo',
  'social_worker': 'Trabajador Social',
  'receptionist': 'Recepcionista',
  'staff': 'Personal',
  'office_manager': 'Gerente de Oficina',
  'event_coordinator': 'Coordinador de Eventos',
  'client': 'Cliente'
};

/**
 * Department-based role filtering for case assignments
 * 
 * This mapping determines which staff roles are appropriate for different
 * types of cases, enabling smart filtering in appointment scheduling.
 */
export const DEPARTMENT_ROLE_MAPPING: { [key: string]: string[] } = {
  'Familiar': ['lawyer', 'attorney', 'senior_attorney', 'paralegal', 'associate'],
  'Civil': ['lawyer', 'attorney', 'senior_attorney', 'paralegal', 'associate'],
  'Psicologia': ['psychologist', 'social_worker'],
  'Recursos': ['social_worker', 'receptionist'],
  'General': ['receptionist', 'event_coordinator']
};

/**
 * Utility functions for role management
 */

/**
 * Get role configuration by value
 * @param roleValue - The role value to look up
 * @returns StaffRole object or undefined if not found
 */
export const getRoleByValue = (roleValue: string): StaffRole | undefined => {
  return STAFF_ROLES.find(role => role.value === roleValue);
};

/**
 * Get all roles for a specific department
 * @param department - The department to filter by
 * @returns Array of StaffRole objects
 */
export const getRolesByDepartment = (department: StaffRole['department']): StaffRole[] => {
  return STAFF_ROLES.filter(role => role.department === department);
};

/**
 * Get roles that can manage users
 * @returns Array of StaffRole objects that can manage users
 */
export const getManagementRoles = (): StaffRole[] => {
  return STAFF_ROLES.filter(role => role.canManageUsers);
};

/**
 * Get roles that require office assignment
 * @returns Array of StaffRole objects that require office assignment
 */
export const getOfficeRequiredRoles = (): StaffRole[] => {
  return STAFF_ROLES.filter(role => role.requiresOffice);
};

/**
 * Get staff roles (excludes client role)
 * @returns Array of StaffRole objects for staff members
 */
export const getStaffRoles = (): StaffRole[] => {
  return STAFF_ROLES.filter(role => role.value !== 'client');
};

/**
 * Get role label with fallback to legacy mapping
 * @param roleValue - The role value to get label for
 * @returns The display label for the role
 */
export const getRoleLabel = (roleValue: string): string => {
  const role = getRoleByValue(roleValue);
  return role?.label || ROLE_LABELS[roleValue] || roleValue;
};

/**
 * Check if a role can manage users
 * @param roleValue - The role value to check
 * @returns True if the role can manage users
 */
export const canManageUsers = (roleValue: string): boolean => {
  const role = getRoleByValue(roleValue);
  return role?.canManageUsers || false;
};

/**
 * Check if a role requires office assignment
 * @param roleValue - The role value to check
 * @returns True if the role requires office assignment
 */
export const requiresOffice = (roleValue: string): boolean => {
  const role = getRoleByValue(roleValue);
  return role?.requiresOffice || false;
};

/**
 * Get roles appropriate for a case category
 * @param category - The case category (e.g., 'Familiar', 'Civil', 'Psicologia')
 * @returns Array of role values appropriate for the category
 */
export const getRolesForCaseCategory = (category: string): string[] => {
  return DEPARTMENT_ROLE_MAPPING[category] || [];
};

/**
 * Check if a role is appropriate for a case category
 * @param roleValue - The role value to check
 * @param category - The case category
 * @returns True if the role is appropriate for the category
 */
export const isRoleAppropriateForCategory = (roleValue: string, category: string): boolean => {
  const allowedRoles = getRolesForCaseCategory(category);
  return allowedRoles.includes(roleValue);
};

/**
 * Get admin roles (admin and office_manager)
 * @returns Array of admin role values
 */
export const getAdminRoles = (): string[] => {
  return ['admin', 'office_manager'];
};

/**
 * Check if a role is an admin role
 * @param roleValue - The role value to check
 * @returns True if the role is an admin role
 */
export const isAdminRole = (roleValue: string): boolean => {
  return getAdminRoles().includes(roleValue);
};
