// admin-portal/src/app/lib/types.ts
// Type definitions for the CAF Admin Portal

// Define status types directly to avoid import issues during build
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type CaseStatus = 'open' | 'in_progress' | 'closed' | 'pending' | 'archived';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// User roles - Updated to match backend and roles.ts configuration
export type UserRole = 'admin' | 'office_manager' | 'lawyer' | 'psychologist' | 'receptionist' | 'event_coordinator' | 'client';

// Notification types
export type NotificationType = 'info' | 'warning' | 'error' | 'success';

// Notification statuses
export type NotificationStatus = 'read' | 'unread' | 'archived';

// Base user interface
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  officeId?: number;
  createdAt: string;
  updatedAt: string;
}

// Authentication user interface
export interface AuthUser {
  id: number;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  email?: string;
}

// Authentication token interface
export interface AuthToken {
  token: string;
  expiresAt: string;
}

// Login response interface
export interface LoginResponse {
  token: string;
  user: AuthUser;
  message?: string;
}

// Login form data interface
export interface LoginFormData {
  email: string;
  password: string;
}

// Case interface
export interface Case {
  id: number;
  title: string;
  description: string;
  category: string;
  status: CaseStatus;
  clientId: number;
  assignedToId?: number;
  officeId: number;
  docketNumber?: string;
  court?: string;
  createdAt: string;
  updatedAt: string;
}

// Case details interface with expanded data
export interface CaseDetails extends Case {
  currentStage: string;
  isCompleted: boolean;
  isArchived: boolean;
  client: User;
  office: { name: string };
  appointments?: any[];
  tasks?: any[];
  caseEvents?: any[];
}

// Appointment interface
export interface Appointment {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  caseId: number;
  staffId: number;
  officeId: number;
  category?: string;
  department?: string;
  createdAt: string;
  updatedAt: string;
}

// Task interface
export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  assignedToId: number;
  caseId?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Notification interface
export interface Notification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  userId: number;
  relatedId?: number;
  relatedType?: string;
  createdAt: string;
  readAt?: string;
}

// Office interface
export interface Office {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  managerId?: number;
  createdAt: string;
  updatedAt: string;
}

// Dashboard summary interface
export interface DashboardSummary {
  totalUsers: number;
  totalCases: number;
  totalAppointments: number;
  totalOffices: number;
  totalStaff: number;
  totalOpenCases: number;
  appointmentsToday: number;
  recentCases: Case[];
  upcomingAppointments: Appointment[];
  recentNotifications: Notification[];
  caseStats: {
    open: number;
    inProgress: number;
    closed: number;
    pending: number;
  };
  appointmentStats: {
    scheduled: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
}

// Pagination parameters
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Enhanced paginated response with performance metrics
export interface EnhancedPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  performance: {
    queryTime: string;
    cacheHit: boolean;
    responseSize: number;
  };
}

// API response wrapper (for backward compatibility)
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Form field interfaces
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'date' | 'time' | 'number';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// Search filters interface
export interface SearchFilters {
  search?: string;
  status?: string;
  category?: string;
  department?: string;
  assignedTo?: number;
  officeId?: number;
  dateFrom?: string;
  dateTo?: string;
  dateRange?: [string, string];
  role?: string;
}

// Select option interface
export interface SelectOption {
  value: string | number;
  label: string;
  key?: string | number;
  children?: string;
  disabled?: boolean;
}
