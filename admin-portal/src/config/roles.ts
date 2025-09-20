/**
 * CAF System - Frontend Role Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all role definitions and permissions
 * in the frontend. All components must use this configuration.
 */

// Staff role keys - must match backend config/roles.go
export const STAFF_ROLES = {
  ADMIN: 'admin',
  OFFICE_MANAGER: 'office_manager',
  LAWYER: 'lawyer',
  PSYCHOLOGIST: 'psychologist',
  RECEPTIONIST: 'receptionist',
  EVENT_COORDINATOR: 'event_coordinator',
} as const;

// Staff role definitions with Spanish labels and departments
export const STAFF_ROLE_DEFINITIONS = {
  [STAFF_ROLES.ADMIN]: {
    key: STAFF_ROLES.ADMIN,
    spanishName: 'Administrador',
    englishName: 'Administrator',
    department: 'Administration',
    description: 'Full system access and management',
    hierarchyLevel: 1,
  },
  [STAFF_ROLES.OFFICE_MANAGER]: {
    key: STAFF_ROLES.OFFICE_MANAGER,
    spanishName: 'Gerente de Oficina',
    englishName: 'Office Manager',
    department: 'Management',
    description: 'Office-level management and oversight',
    hierarchyLevel: 2,
  },
  [STAFF_ROLES.LAWYER]: {
    key: STAFF_ROLES.LAWYER,
    spanishName: 'Abogado/a',
    englishName: 'Lawyer',
    department: 'Legal',
    description: 'Legal case management and documentation',
    hierarchyLevel: 3,
  },
  [STAFF_ROLES.PSYCHOLOGIST]: {
    key: STAFF_ROLES.PSYCHOLOGIST,
    spanishName: 'Psicólogo/a',
    englishName: 'Psychologist',
    department: 'Psychology',
    description: 'Psychological assessment and counseling',
    hierarchyLevel: 3,
  },
  [STAFF_ROLES.RECEPTIONIST]: {
    key: STAFF_ROLES.RECEPTIONIST,
    spanishName: 'Recepcionista',
    englishName: 'Receptionist',
    department: 'Administration',
    description: 'Front desk and appointment management',
    hierarchyLevel: 4,
  },
  [STAFF_ROLES.EVENT_COORDINATOR]: {
    key: STAFF_ROLES.EVENT_COORDINATOR,
    spanishName: 'Coordinador/a de Eventos',
    englishName: 'Event Coordinator',
    department: 'Events',
    description: 'Event planning and coordination',
    hierarchyLevel: 5,
  },
} as const;

// Type definitions
export type StaffRoleKey = typeof STAFF_ROLES[keyof typeof STAFF_ROLES];
export type StaffRoleDefinition = typeof STAFF_ROLE_DEFINITIONS[StaffRoleKey];

// Navigation menu items with role-based permissions
export const NAVIGATION_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/app',
    icon: 'DashboardOutlined',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST, STAFF_ROLES.RECEPTIONIST, STAFF_ROLES.EVENT_COORDINATOR],
  },
  {
    key: 'appointments',
    label: 'Citas',
    path: '/app/appointments',
    icon: 'CalendarOutlined',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST, STAFF_ROLES.RECEPTIONIST],
  },
  {
    key: 'cases',
    label: 'Casos',
    path: '/app/cases',
    icon: 'FileTextOutlined',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST, STAFF_ROLES.RECEPTIONIST],
  },
  {
    key: 'users',
    label: 'Usuarios',
    path: '/app/users',
    icon: 'UserOutlined',
    permissions: [STAFF_ROLES.ADMIN],
  },
  {
    key: 'offices',
    label: 'Oficinas',
    path: '/app/offices',
    icon: 'BankOutlined',
    permissions: [STAFF_ROLES.ADMIN],
  },
  {
    key: 'files',
    label: 'Archivos',
    path: '/app/files',
    icon: 'FolderOutlined',
    permissions: [STAFF_ROLES.ADMIN],
  },
  {
    key: 'web-content',
    label: 'Contenido Web',
    path: '/app/web-content',
    icon: 'GlobalOutlined',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.EVENT_COORDINATOR],
  },
] as const;

// Permission checking functions
export const PERMISSIONS = {
  // Data access permissions
  canAccessAllOffices: (role: StaffRoleKey): boolean => {
    return role === STAFF_ROLES.ADMIN;
  },

  canManageUsers: (role: StaffRoleKey): boolean => {
    return role === STAFF_ROLES.ADMIN;
  },

  canManageOffices: (role: StaffRoleKey): boolean => {
    return role === STAFF_ROLES.ADMIN;
  },

  canManageFiles: (role: StaffRoleKey): boolean => {
    return role === STAFF_ROLES.ADMIN;
  },

  canManageWebContent: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.EVENT_COORDINATOR].includes(role as any);
  },

  canViewCases: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST, STAFF_ROLES.RECEPTIONIST].includes(role as any);
  },

  canViewAppointments: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST, STAFF_ROLES.RECEPTIONIST].includes(role as any);
  },

  canViewEvents: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.EVENT_COORDINATOR].includes(role as any);
  },

  // Document access permissions (Privacy Wall)
  canViewLegalDocuments: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.LAWYER].includes(role as any);
  },

  canViewPsychologicalDocuments: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.PSYCHOLOGIST].includes(role as any);
  },

  // Dashboard widget permissions
  canSeeAdminWidgets: (role: StaffRoleKey): boolean => {
    return role === STAFF_ROLES.ADMIN;
  },

  canSeeOfficeManagerWidgets: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER].includes(role as any);
  },

  canSeeProfessionalWidgets: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST].includes(role as any);
  },

  canSeeReceptionistWidgets: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.RECEPTIONIST].includes(role as any);
  },

  canSeeEventCoordinatorWidgets: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.EVENT_COORDINATOR].includes(role as any);
  },

  // Role hierarchy functions
  isProfessionalRole: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST].includes(role as any);
  },

  isAdministrativeRole: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.RECEPTIONIST].includes(role as any);
  },

  isManagementRole: (role: StaffRoleKey): boolean => {
    return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER].includes(role as any);
  },

  hasHigherOrEqualAccess: (role1: StaffRoleKey, role2: StaffRoleKey): boolean => {
    const level1 = STAFF_ROLE_DEFINITIONS[role1].hierarchyLevel;
    const level2 = STAFF_ROLE_DEFINITIONS[role2].hierarchyLevel;
    return level1 <= level2;
  },
} as const;

// Utility functions
export const getRoleDefinition = (role: StaffRoleKey): StaffRoleDefinition => {
  return STAFF_ROLE_DEFINITIONS[role];
};

export const getAllRoles = (): StaffRoleDefinition[] => {
  return Object.values(STAFF_ROLE_DEFINITIONS);
};

export const getRolesByDepartment = (department: string): StaffRoleDefinition[] => {
  return Object.values(STAFF_ROLE_DEFINITIONS).filter(role => role.department === department);
};

export const isValidRole = (role: string): role is StaffRoleKey => {
  return Object.values(STAFF_ROLES).includes(role as StaffRoleKey);
};

// Navigation filtering
export const getNavigationItemsForRole = (role: StaffRoleKey) => {
  return NAVIGATION_ITEMS.filter(item => item.permissions.includes(role as any));
};

// Dashboard widget configuration
export const DASHBOARD_WIDGETS = {
  // Admin-only widgets
  systemStats: {
    key: 'system-stats',
    title: 'Estadísticas del Sistema',
    permissions: [STAFF_ROLES.ADMIN],
  },
  userManagement: {
    key: 'user-management',
    title: 'Gestión de Usuarios',
    permissions: [STAFF_ROLES.ADMIN],
  },
  officeOverview: {
    key: 'office-overview',
    title: 'Resumen de Oficinas',
    permissions: [STAFF_ROLES.ADMIN],
  },

  // Office Manager widgets
  officeStats: {
    key: 'office-stats',
    title: 'Estadísticas de Oficina',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER],
  },
  staffPerformance: {
    key: 'staff-performance',
    title: 'Rendimiento del Personal',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER],
  },

  // Professional widgets
  caseLoad: {
    key: 'case-load',
    title: 'Carga de Casos',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST],
  },
  upcomingAppointments: {
    key: 'upcoming-appointments',
    title: 'Próximas Citas',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST],
  },

  // Receptionist widgets
  todayAppointments: {
    key: 'today-appointments',
    title: 'Citas de Hoy',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.RECEPTIONIST],
  },
  clientCheckIns: {
    key: 'client-check-ins',
    title: 'Registros de Clientes',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.RECEPTIONIST],
  },

  // Event Coordinator widgets
  upcomingEvents: {
    key: 'upcoming-events',
    title: 'Próximos Eventos',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.EVENT_COORDINATOR],
  },
  eventRegistrations: {
    key: 'event-registrations',
    title: 'Registros de Eventos',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.EVENT_COORDINATOR],
  },
} as const;

export const getDashboardWidgetsForRole = (role: StaffRoleKey) => {
  return Object.values(DASHBOARD_WIDGETS).filter(widget =>
    widget.permissions.includes(role as any)
  );
};

// Case detail page privacy wall configuration
export const CASE_DOCUMENT_TYPES = {
  LEGAL: 'legal',
  PSYCHOLOGICAL: 'psychological',
  GENERAL: 'general',
} as const;

export const CASE_DOCUMENT_PERMISSIONS = {
  [CASE_DOCUMENT_TYPES.LEGAL]: {
    label: 'Documentos Legales',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.LAWYER],
  },
  [CASE_DOCUMENT_TYPES.PSYCHOLOGICAL]: {
    label: 'Documentos Psicológicos',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.PSYCHOLOGIST],
  },
  [CASE_DOCUMENT_TYPES.GENERAL]: {
    label: 'Documentos Generales',
    permissions: [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST, STAFF_ROLES.RECEPTIONIST],
  },
} as const;

export const canViewDocumentType = (role: StaffRoleKey, documentType: string): boolean => {
  const permissions = CASE_DOCUMENT_PERMISSIONS[documentType as keyof typeof CASE_DOCUMENT_PERMISSIONS];
  return permissions ? permissions.permissions.includes(role as any) : false;
};

// Export all role keys for easy access
export const ALL_ROLE_KEYS = Object.values(STAFF_ROLES);

// Additional utility functions for backward compatibility
export const requiresOffice = (role: StaffRoleKey): boolean => {
  return role !== STAFF_ROLES.ADMIN;
};

export const getRoleByValue = (value: string): StaffRoleDefinition | undefined => {
  return STAFF_ROLE_DEFINITIONS[value as StaffRoleKey];
};

export const canManageUsers = (role: StaffRoleKey): boolean => {
  return PERMISSIONS.canManageUsers(role);
};

export const getRolesForCaseCategory = (category: string): StaffRoleKey[] => {
  switch (category) {
    case 'legal':
      return [STAFF_ROLES.ADMIN, STAFF_ROLES.LAWYER];
    case 'psychology':
      return [STAFF_ROLES.ADMIN, STAFF_ROLES.PSYCHOLOGIST];
    case 'social_work':
      return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.RECEPTIONIST];
    default:
      return [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.LAWYER, STAFF_ROLES.PSYCHOLOGIST, STAFF_ROLES.RECEPTIONIST];
  }
};

export const isAdminRole = (role: StaffRoleKey): boolean => {
  return role === STAFF_ROLES.ADMIN;
};

export const getRoleLabel = (role: StaffRoleKey): string => {
  return getRoleDefinition(role).spanishName;
};

// Additional exports for backward compatibility
export const ROLE_LABELS = Object.fromEntries(
  Object.entries(STAFF_ROLE_DEFINITIONS).map(([key, def]) => [key, def.spanishName])
);

export const DEPARTMENT_ROLE_MAPPING = {
  'legal': [STAFF_ROLES.ADMIN, STAFF_ROLES.LAWYER],
  'psychology': [STAFF_ROLES.ADMIN, STAFF_ROLES.PSYCHOLOGIST],
  'social_work': [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.RECEPTIONIST],
  'management': [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER],
  'administration': [STAFF_ROLES.ADMIN, STAFF_ROLES.OFFICE_MANAGER, STAFF_ROLES.RECEPTIONIST],
  'events': [STAFF_ROLES.ADMIN, STAFF_ROLES.EVENT_COORDINATOR],
};