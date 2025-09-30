// admin-portal/src/config/statuses.ts
// Centralized status configuration - single source of truth for frontend

// Case Statuses
export const CASE_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
  PENDING: 'pending',
  ARCHIVED: 'archived',
} as const;

export type CaseStatus = typeof CASE_STATUSES[keyof typeof CASE_STATUSES];

export const CASE_STATUS_DISPLAY_NAMES = {
  [CASE_STATUSES.OPEN]: 'Abierto',
  [CASE_STATUSES.IN_PROGRESS]: 'En Progreso',
  [CASE_STATUSES.CLOSED]: 'Cerrado',
  [CASE_STATUSES.PENDING]: 'Pendiente',
  [CASE_STATUSES.ARCHIVED]: 'Archivado',
} as const;

export const CASE_STATUS_OPTIONS = Object.entries(CASE_STATUS_DISPLAY_NAMES).map(([value, label]) => ({
  value,
  label,
}));

// Appointment Statuses
export const APPOINTMENT_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[keyof typeof APPOINTMENT_STATUSES];

export const APPOINTMENT_STATUS_DISPLAY_NAMES = {
  [APPOINTMENT_STATUSES.PENDING]: 'Pendiente',
  [APPOINTMENT_STATUSES.CONFIRMED]: 'Confirmada',
  [APPOINTMENT_STATUSES.COMPLETED]: 'Completada',
  [APPOINTMENT_STATUSES.CANCELLED]: 'Cancelada',
  [APPOINTMENT_STATUSES.NO_SHOW]: 'No se presentó',
} as const;

export const APPOINTMENT_STATUS_OPTIONS = Object.entries(APPOINTMENT_STATUS_DISPLAY_NAMES).map(([value, label]) => ({
  value,
  label,
}));

// Task Statuses
export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

export const TASK_STATUS_DISPLAY_NAMES = {
  [TASK_STATUSES.PENDING]: 'Pendiente',
  [TASK_STATUSES.IN_PROGRESS]: 'En Progreso',
  [TASK_STATUSES.COMPLETED]: 'Completada',
  [TASK_STATUSES.CANCELLED]: 'Cancelada',
} as const;

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_DISPLAY_NAMES).map(([value, label]) => ({
  value,
  label,
}));

// Helper functions
export const getCaseStatusDisplayName = (status: string): string => {
  return CASE_STATUS_DISPLAY_NAMES[status as CaseStatus] || status;
};

export const getAppointmentStatusDisplayName = (status: string): string => {
  return APPOINTMENT_STATUS_DISPLAY_NAMES[status as AppointmentStatus] || status;
};

export const getTaskStatusDisplayName = (status: string): string => {
  return TASK_STATUS_DISPLAY_NAMES[status as TaskStatus] || status;
};

// Additional exports for backward compatibility
export const APPOINTMENT_STATUS_CONFIG = {
  [APPOINTMENT_STATUSES.PENDING]: {
    label: APPOINTMENT_STATUS_DISPLAY_NAMES[APPOINTMENT_STATUSES.PENDING],
    color: 'orange',
    icon: 'clock-circle',
  },
  [APPOINTMENT_STATUSES.CONFIRMED]: {
    label: APPOINTMENT_STATUS_DISPLAY_NAMES[APPOINTMENT_STATUSES.CONFIRMED],
    color: 'blue',
    icon: 'check-circle',
  },
  [APPOINTMENT_STATUSES.COMPLETED]: {
    label: APPOINTMENT_STATUS_DISPLAY_NAMES[APPOINTMENT_STATUSES.COMPLETED],
    color: 'green',
    icon: 'check-circle',
  },
  [APPOINTMENT_STATUSES.CANCELLED]: {
    label: APPOINTMENT_STATUS_DISPLAY_NAMES[APPOINTMENT_STATUSES.CANCELLED],
    color: 'red',
    icon: 'close-circle',
  },
  [APPOINTMENT_STATUSES.NO_SHOW]: {
    label: APPOINTMENT_STATUS_DISPLAY_NAMES[APPOINTMENT_STATUSES.NO_SHOW],
    color: 'gray',
    icon: 'exclamation-circle',
  },
};

export const getValidAppointmentStatuses = (): string[] => {
  return Object.values(APPOINTMENT_STATUSES);
};