import { ORGANIZATION_TEXT } from '@/config/organizations';
// admin-portal/src/config/roles.ts
// Centralized role configuration - single source of truth for frontend

export const USER_ROLES = {
  TECHNICAL_SUPPORT: 'technical_support',
  EXECUTIVE_DIRECTOR: 'executive_director',
  ADMIN: 'admin',
  LAWYER: 'lawyer',
  PSYCHOLOGIST: 'psychologist',
  RECEPTIONIST: 'receptionist',
  EVENT_COORDINATOR: 'event_coordinator',
  CLIENT: 'client',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_DISPLAY_NAMES = {
  [USER_ROLES.TECHNICAL_SUPPORT]: 'Soporte Tecnico',
  [USER_ROLES.EXECUTIVE_DIRECTOR]: 'Director Ejecutivo',
  [USER_ROLES.ADMIN]: 'Administrador',
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

export const canAccessAllOffices = (role: string): boolean => role === USER_ROLES.TECHNICAL_SUPPORT || role === USER_ROLES.EXECUTIVE_DIRECTOR;
export const canManageWebContent = canAccessAllOffices;

// Helper functions
export const getRoleDisplayName = (role: string): string => {
  return ROLE_DISPLAY_NAMES[role as UserRole] || role;
};

export const isAdminRole = (role: string): boolean => {
  return canAccessAllOffices(role) || role === USER_ROLES.ADMIN;
};

export const isManagementRole = (role: string): boolean => {
  return isAdminRole(role);
};

interface UserManagementSubject {
  role: string;
  officeId?: number | null;
}

export const USER_MANAGEMENT_DENIED_MESSAGE = 'No tiene permisos para modificar esta cuenta.';

// Match the API's actor/target policy, including executives who still have an
// office assigned from before their promotion.
export const canManageUser = (
  actor: UserManagementSubject | null | undefined,
  target: UserManagementSubject | null | undefined,
): boolean => {
  if (!actor || !target || !isManagementRole(actor.role)) return false;
  if (target.role === USER_ROLES.TECHNICAL_SUPPORT) return actor.role === USER_ROLES.TECHNICAL_SUPPORT;
  if (canAccessAllOffices(actor.role)) return true;
  if (target.role === USER_ROLES.EXECUTIVE_DIRECTOR) return false;
  return Boolean(actor.officeId && target.officeId === actor.officeId);
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
  [USER_ROLES.TECHNICAL_SUPPORT]: { key: USER_ROLES.TECHNICAL_SUPPORT, displayName: ROLE_DISPLAY_NAMES[USER_ROLES.TECHNICAL_SUPPORT], department: 'IT' },
  [USER_ROLES.EXECUTIVE_DIRECTOR]: {
    key: USER_ROLES.EXECUTIVE_DIRECTOR,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.EXECUTIVE_DIRECTOR],
    department: 'Management',
  },
  [USER_ROLES.ADMIN]: {
    key: USER_ROLES.ADMIN,
    displayName: ROLE_DISPLAY_NAMES[USER_ROLES.ADMIN],
    department: 'Administration',
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
  [USER_ROLES.TECHNICAL_SUPPORT]: ['*'],
  [USER_ROLES.EXECUTIVE_DIRECTOR]: ['*'],
  [USER_ROLES.ADMIN]: ['cases.read', 'cases.write', 'appointments.read', 'appointments.write', 'users.read', 'users.write', 'manage_offices', 'documents.read', 'reports.read', 'records.write'],
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
  [USER_ROLES.TECHNICAL_SUPPORT]: Object.values(CASE_DOCUMENT_TYPES),
  [USER_ROLES.EXECUTIVE_DIRECTOR]: Object.values(CASE_DOCUMENT_TYPES),
  [USER_ROLES.ADMIN]: Object.values(CASE_DOCUMENT_TYPES),
  [USER_ROLES.LAWYER]: [CASE_DOCUMENT_TYPES.LEGAL, CASE_DOCUMENT_TYPES.GENERAL],
  [USER_ROLES.PSYCHOLOGIST]: [CASE_DOCUMENT_TYPES.PSYCHOLOGICAL, CASE_DOCUMENT_TYPES.GENERAL],
  [USER_ROLES.RECEPTIONIST]: [CASE_DOCUMENT_TYPES.GENERAL],
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
    USER_ROLES.ADMIN,
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

// Sidebar section labels in formal Mexican Spanish (usted form / formal register)
export const getNavigationItemsForRole = (role: string) => {
  const baseItems = [
    { key: 'dashboard', label: 'Panel de Control', path: '/', icon: 'DashboardOutlined' },
    { key: 'cases', label: 'Expedientes', path: '/app/cases', icon: 'FileTextOutlined' },
    { key: 'appointments', label: 'Citas', path: '/app/appointments', icon: 'CalendarOutlined' },
    ...(role !== USER_ROLES.CLIENT
      ? [{ key: 'calendar', label: 'Calendario', path: '/app/calendar', icon: 'ScheduleOutlined' }]
      : []),
    ...(role !== USER_ROLES.CLIENT ? [
      { key: 'maquilas', label: ORGANIZATION_TEXT.maquila.title, path: '/app/maquilas', icon: 'BuildOutlined' },
      { key: 'constructoras', label: ORGANIZATION_TEXT.constructora.title, path: '/app/constructoras', icon: 'ToolOutlined' },
    ] : []),
    { key: 'notifications', label: 'Notificaciones', path: '/app/notifications', icon: 'BellOutlined' },
  ];

  if (isAdminRole(role)) {
    return [
      ...baseItems,
      { key: 'users', label: 'Usuarios', path: '/app/users', icon: 'UserOutlined' },
      { key: 'offices', label: 'Oficinas', path: '/app/offices', icon: 'BankOutlined' },
      ...(canManageWebContent(role) ? [{ key: 'web-content', label: 'Sitio Web', path: '/app/web-content', icon: 'GlobalOutlined' }] : []),
      { key: 'records', label: 'Archivos', path: '/app/records', icon: 'FileOutlined' },
      { key: 'reports', label: 'Reportes', path: '/app/reports', icon: 'BarChartOutlined' },
    ];
  }

  return baseItems;
};

export const getRoleDefinition = (role: string) => {
  return (STAFF_ROLES as any)[role] || { key: role, displayName: role, department: 'Unknown' };
};

export const getDashboardWidgetsForRole = (role: string) => {
  const baseWidgets = ['today-appointments', 'upcoming-appointments'];

  if (canAccessAllOffices(role)) {
    return [...baseWidgets, 'user-management', 'system-stats', 'office-overview'];
  }

  if (isManagementRole(role)) {
    return [...baseWidgets, 'office-stats', 'staff-performance'];
  }

  return baseWidgets;
};

export const canResetPasswords = (role: string): boolean => role === USER_ROLES.TECHNICAL_SUPPORT;

// Support is provisioned through bootstrap/migration, never ordinary role grants.
export const getAssignableRoles = (actorRole: string, targetRole?: string) => {
  if (!isManagementRole(actorRole)) return [];
  if (targetRole === USER_ROLES.TECHNICAL_SUPPORT) {
    return actorRole === USER_ROLES.TECHNICAL_SUPPORT
      ? ROLE_OPTIONS.filter(role => role.value === USER_ROLES.TECHNICAL_SUPPORT) : [];
  }
  return ROLE_OPTIONS.filter(({ value }) => value !== USER_ROLES.TECHNICAL_SUPPORT &&
    (canAccessAllOffices(actorRole) || value !== USER_ROLES.EXECUTIVE_DIRECTOR));
};

// Only practitioner roles have a professional specialty.
export const supportsProfessionalSpecialty = (role: string): boolean =>
  role === USER_ROLES.LAWYER || role === USER_ROLES.PSYCHOLOGIST;
