// admin-portal/src/config/statuses.ts
// Centralized status definitions for the CAF Admin Portal
// This file serves as the single source of truth for all status values

import { TagProps } from 'antd';

// Appointment status type - matches backend exactly
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// Case status type - matches backend exactly
export type CaseStatus = 'open' | 'in_progress' | 'closed' | 'pending' | 'archived';

// Task status type - matches backend exactly
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// Appointment status configuration
export const APPOINTMENT_STATUS_CONFIG: Record<AppointmentStatus, {
  label: string;
  color: TagProps['color'];
  description: string;
}> = {
  pending: {
    label: 'Pendiente',
    color: 'orange',
    description: 'Nueva solicitud que no ha sido revisada por el personal'
  },
  confirmed: {
    label: 'Confirmada',
    color: 'blue',
    description: 'Cita programada y confirmada con el cliente'
  },
  completed: {
    label: 'Completada',
    color: 'green',
    description: 'La cita se realizó y está finalizada'
  },
  cancelled: {
    label: 'Cancelada',
    color: 'red',
    description: 'La cita fue cancelada antes de realizarse'
  },
  no_show: {
    label: 'No se presentó',
    color: 'volcano',
    description: 'El cliente no se presentó a la cita confirmada'
  }
};

// Case status configuration
export const CASE_STATUS_CONFIG: Record<CaseStatus, {
  label: string;
  color: TagProps['color'];
  description: string;
}> = {
  open: {
    label: 'Abierto',
    color: 'blue',
    description: 'Caso activo en proceso'
  },
  in_progress: {
    label: 'En Progreso',
    color: 'orange',
    description: 'Caso siendo procesado activamente'
  },
  closed: {
    label: 'Cerrado',
    color: 'green',
    description: 'Caso completado exitosamente'
  },
  pending: {
    label: 'Pendiente',
    color: 'yellow',
    description: 'Caso esperando acción'
  },
  archived: {
    label: 'Archivado',
    color: 'gray',
    description: 'Caso archivado para referencia histórica'
  }
};

// Task status configuration
export const TASK_STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  color: TagProps['color'];
  description: string;
}> = {
  pending: {
    label: 'Pendiente',
    color: 'orange',
    description: 'Tarea creada pero no iniciada'
  },
  in_progress: {
    label: 'En Progreso',
    color: 'blue',
    description: 'Tarea siendo trabajada activamente'
  },
  completed: {
    label: 'Completada',
    color: 'green',
    description: 'Tarea finalizada exitosamente'
  },
  cancelled: {
    label: 'Cancelada',
    color: 'red',
    description: 'Tarea cancelada sin completar'
  }
};

// Utility functions
export const getAppointmentStatusConfig = (status: AppointmentStatus) => {
  return APPOINTMENT_STATUS_CONFIG[status];
};

export const getCaseStatusConfig = (status: CaseStatus) => {
  return CASE_STATUS_CONFIG[status];
};

export const getTaskStatusConfig = (status: TaskStatus) => {
  return TASK_STATUS_CONFIG[status];
};

// Get all valid appointment statuses
export const getValidAppointmentStatuses = (): AppointmentStatus[] => {
  return Object.keys(APPOINTMENT_STATUS_CONFIG) as AppointmentStatus[];
};

// Get all valid case statuses
export const getValidCaseStatuses = (): CaseStatus[] => {
  return Object.keys(CASE_STATUS_CONFIG) as CaseStatus[];
};

// Get all valid task statuses
export const getValidTaskStatuses = (): TaskStatus[] => {
  return Object.keys(TASK_STATUS_CONFIG) as TaskStatus[];
};

// Validation functions
export const isValidAppointmentStatus = (status: string): status is AppointmentStatus => {
  return status in APPOINTMENT_STATUS_CONFIG;
};

export const isValidCaseStatus = (status: string): status is CaseStatus => {
  return status in CASE_STATUS_CONFIG;
};

export const isValidTaskStatus = (status: string): status is TaskStatus => {
  return status in TASK_STATUS_CONFIG;
};

// Status transition helpers
export const getValidAppointmentStatusTransitions = (currentStatus: AppointmentStatus): AppointmentStatus[] => {
  const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled', 'no_show'],
    completed: [], // Terminal state
    cancelled: [], // Terminal state
    no_show: ['confirmed'] // Can reschedule
  };
  
  return transitions[currentStatus] || [];
};

export const canTransitionTo = (from: AppointmentStatus, to: AppointmentStatus): boolean => {
  return getValidAppointmentStatusTransitions(from).includes(to);
};
