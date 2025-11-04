// admin-portal/src/config/roles.ts
// Centralized role configuration - single source of truth for frontend

export const USER_ROLES = {
  ADMIN: 'admin',
  OFFICE_MANAGER: 'office_manager',
  LAWYER: 'lawyer',
  PSYCHOLOGIST: 'psychologist',
  RECEPTIONIST: 'receptionist',
  EVENT_COORDINATOR: 'event_coordinator',
  CLIENT: 'client',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_DISPLAY_NAMES = {
  [USER_ROLES.ADMIN]: 'Administrador',
  [USER_ROLES.OFFICE_MANAGER]: 'Gerente de Oficina',
  [USER_ROLES.LAWYER]: 'Abogado/a',
  [USER_ROLES.PSYCHOLOGIST]: 'Psicólogo/a',
  [USER_ROLES.RECEPTIONIST]: 'Recepcionista',
  [USER_ROLES.EVENT_COORDINATOR]: 'Coordinador/a de Eventos',
  [USER_ROLES.CLIENT]: 'Cliente',
} as const;

export const ROLE_OPTIONS = Object.entries(ROLE_DISPLAY_NAMES).map(([value, label]) => ({
  value,
  label,
}));

// Helper functions
export const getRoleDisplayName = (role: string): string => {
  return ROLE_DISPLAY_NAMES[role as UserRole] || role;
};

export const isAdminRole = (role: string): boolean => {
  return role === USER_ROLES.ADMIN;
};

export const isManagementRole = (role: string): boolean => {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.OFFICE_MANAGER;
};

export const isProfessionalRole = (role: string): boolean => {
  return role === USER_ROLES.LAWYER || role === USER_ROLES.PSYCHOLOGIST;
};

export const isStaffRole = (role: string): boolean => {
  const staffRoles: UserRole[] = [
    USER_ROLES.LAWYER,
    USER_ROLES.PSYCHOLOGIST,
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.EVENT_COORDINATOR,
  ];
  return staffRoles.includes(role as UserRole);
};

// Additional helper functions for backward compatibility
export const getRolesForCaseCategory = (category: string): UserRole[] => {
  // Return all staff roles for any category - can be customized later
  return [
    USER_ROLES.LAWYER,
    USER_ROLES.PSYCHOLOGIST,
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.EVENT_COORDINATOR,
  ];
};

export type StaffRoleKey = UserRole;

// Additional exports for backward compatibility
export const STAFF_ROLES = {
  [USER_ROLES.ADMIN]: {
    key: USER_ROLES.ADMIN,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.ADMIN],
    department: 'Administration',
  },
  [USER_ROLES.OFFICE_MANAGER]: {
    key: USER_ROLES.OFFICE_MANAGER,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.OFFICE_MANAGER],
    department: 'Management',
  },
  [USER_ROLES.LAWYER]: {
    key: USER_ROLES.LAWYER,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.LAWYER],
    department: 'Legal',
  },
  [USER_ROLES.PSYCHOLOGIST]: {
    key: USER_ROLES.PSYCHOLOGIST,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.PSYCHOLOGIST],
    department: 'Psychology',
  },
  [USER_ROLES.RECEPTIONIST]: {
    key: USER_ROLES.RECEPTIONIST,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.RECEPTIONIST],
    department: 'Administration',
  },
  [USER_ROLES.EVENT_COORDINATOR]: {
    key: USER_ROLES.EVENT_COORDINATOR,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.EVENT_COORDINATOR],
    department: 'Events',
  },
};

export const PERMISSIONS = {
  [USER_ROLES.ADMIN]: ['*'], // Admin has all permissions
  [USER_ROLES.OFFICE_MANAGER]: ['cases.read', 'cases.write', 'appointments.read', 'appointments.write', 'users.read', 'manage_offices'],
  [USER_ROLES.LAWYER]: ['cases.read', 'cases.write', 'appointments.read', 'appointments.write', 'documents.read'],
  [USER_ROLES.PSYCHOLOGIST]: ['cases.read', 'cases.write', 'appointments.read', 'appointments.write', 'documents.read'],
  [USER_ROLES.RECEPTIONIST]: ['cases.read', 'appointments.read', 'appointments.write', 'users.read'],
  [USER_ROLES.EVENT_COORDINATOR]: ['events.read', 'events.write'],
  [USER_ROLES.CLIENT]: ['cases.read', 'appointments.read'],
};

// Document types and permissions
export const CASE_DOCUMENT_TYPES = {
  LEGAL: 'legal',
  PSYCHOLOGICAL: 'psychological',
  GENERAL: 'general',
  MEDICAL: 'medical',
  FINANCIAL: 'financial',
} as const;

export const CASE_DOCUMENT_PERMISSIONS = {
  [USER_ROLES.ADMIN]: Object.values(CASE_DOCUMENT_TYPES),
  [USER_ROLES.LAWYER]: [CASE_DOCUMENT_TYPES.LEGAL, CASE_DOCUMENT_TYPES.GENERAL],
  [USER_ROLES.PSYCHOLOGIST]: [CASE_DOCUMENT_TYPES.PSYCHOLOGICAL, CASE_DOCUMENT_TYPES.GENERAL],
  [USER_ROLES.RECEPTIONIST]: [CASE_DOCUMENT_TYPES.GENERAL],
  [USER_ROLES.OFFICE_MANAGER]: Object.values(CASE_DOCUMENT_TYPES),
  [USER_ROLES.EVENT_COORDINATOR]: [CASE_DOCUMENT_TYPES.GENERAL],
  [USER_ROLES.CLIENT]: [],
};

// Helper functions
export const getAllRoles = (): Array<{ value: string; label: string }> => {
  return ROLE_OPTIONS;
};

export const isValidRole = (role: string): boolean => {
  return Object.values(USER_ROLES).includes(role as UserRole);
};

export const requiresOffice = (role: string): boolean => {
  return [
    USER_ROLES.OFFICE_MANAGER,
    USER_ROLES.LAWYER,
    USER_ROLES.PSYCHOLOGIST,
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.EVENT_COORDINATOR,
  ].includes(role as any);
};

export const canViewDocumentType = (userRole: string, documentType: string): boolean => {
  const allowedTypes = (CASE_DOCUMENT_PERMISSIONS as any)[userRole] || [];
  return allowedTypes.includes(documentType);
};

export const getNavigationItemsForRole = (role: string) => {
  const baseItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/', icon: 'DashboardOutlined' },
    { key: 'cases', label: 'Cases', path: '/app/cases', icon: 'FileTextOutlined' },
    { key: 'appointments', label: 'Appointments', path: '/app/appointments', icon: 'CalendarOutlined' },
  ];

  if (isAdminRole(role)) {
    return [
      ...baseItems,
      { key: 'users', label: 'Users', path: '/app/users', icon: 'UserOutlined' },
      { key: 'offices', label: 'Offices', path: '/app/offices', icon: 'BankOutlined' },
      { key: 'records', label: 'Records', path: '/app/records', icon: 'FileOutlined' },
      { key: 'reports', label: 'Reports', path: '/app/reports', icon: 'BarChartOutlined' },
    ];
  }

  if (isManagementRole(role)) {
    return [
      ...baseItems,
      { key: 'users', label: 'Users', path: '/app/users', icon: 'UserOutlined' },
      { key: 'records', label: 'Records', path: '/app/records', icon: 'FileOutlined' },
      { key: 'reports', label: 'Reports', path: '/app/reports', icon: 'BarChartOutlined' },
    ];
  }

  return baseItems;
};

export const getRoleDefinition = (role: string) => {
  return (STAFF_ROLES as any)[role] || { key: role, displayName: role, department: 'Unknown' };
};

export const getDashboardWidgetsForRole = (role: string) => {
  const baseWidgets = ['cases', 'appointments'];
  
  if (isAdminRole(role)) {
    return [...baseWidgets, 'users', 'system_health', 'reports'];
  }
  
  if (isManagementRole(role)) {
    return [...baseWidgets, 'users', 'reports'];
  }
  
  return baseWidgets;
};