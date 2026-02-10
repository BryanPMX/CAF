// admin-portal/src/interfaces/services.ts
import { User, Case, Appointment, Office } from '@/app/lib/types';
import { PaginatedResponse } from '@/interfaces/api';

// Re-export for convenience
export type { PaginatedResponse } from '@/interfaces/api';

// Case Service Interface
export interface ICaseService {
  getCases(params?: CaseListParams): Promise<PaginatedResponse<Case>>;
  getCaseById(id: string): Promise<Case>;
  createCase(caseData: CreateCaseRequest): Promise<Case>;
  updateCase(id: string, caseData: UpdateCaseRequest): Promise<Case>;
  deleteCase(id: string): Promise<void>;
  archiveCase(id: string): Promise<Case>;
  getCasesAssignedToUser(userId: string): Promise<Case[]>;
}

// Appointment Service Interface
export interface IAppointmentService {
  getAppointments(params?: AppointmentListParams): Promise<PaginatedResponse<Appointment>>;
  getAppointmentById(id: string): Promise<Appointment>;
  createAppointment(appointmentData: CreateAppointmentRequest): Promise<Appointment>;
  updateAppointment(id: string, appointmentData: UpdateAppointmentRequest): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;
  getAppointmentsByCase(caseId: string): Promise<Appointment[]>;
}

// User Service Interface
export interface IUserService {
  getCurrentUser(): Promise<User>;
  updateProfile(updates: UserProfileUpdate): Promise<User>;
  getUsers(params?: UserListParams): Promise<PaginatedResponse<User>>;
  createUser(userData: CreateUserRequest): Promise<User>;
  updateUser(id: string, updates: UpdateUserRequest): Promise<User>;
  deleteUser(id: string): Promise<void>;
}

// Office Service Interface
export interface IOfficeService {
  getOffices(): Promise<Office[]>;
  getOfficeById(id: string): Promise<Office>;
  createOffice(officeData: CreateOfficeRequest): Promise<Office>;
  updateOffice(id: string, updates: UpdateOfficeRequest): Promise<Office>;
  deleteOffice(id: string): Promise<void>;
}

// Dashboard Service Interface
export interface IDashboardService {
  getDashboardSummary(params?: DashboardParams): Promise<DashboardSummary>;
  getStaffDashboard(): Promise<StaffDashboardSummary>;
}

// Report Service Interface
export interface IReportService {
  getCaseReports(params?: ReportParams): Promise<CaseReport>;
  getAppointmentReports(params?: ReportParams): Promise<AppointmentReport>;
  getUserActivityReports(params?: ReportParams): Promise<UserActivityReport>;
  exportReport(reportType: string, params?: ReportParams): Promise<Blob>;
}

// Request/Response Types
export interface CreateCaseRequest {
  title: string;
  description?: string;
  client_id: number;
  office_id: number;
  category: string;
  priority: string;
}

export interface UpdateCaseRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_id?: string;
}

export interface CreateAppointmentRequest {
  title: string;
  description?: string;
  case_id: number;
  start_time: string;
  end_time: string;
  status: string;
  assigned_to?: string;
}

export interface UpdateAppointmentRequest {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  assigned_to?: string;
}

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  office_id: number;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  role?: string;
  office_id?: number;
  status?: string;
}

export interface UserProfileUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface CreateOfficeRequest {
  name: string;
  address?: string;
  phoneOffice?: string;
  phoneCell?: string;
}

export interface UpdateOfficeRequest {
  name?: string;
  address?: string;
  phoneOffice?: string;
  phoneCell?: string;
}

// Parameter Types
export interface CaseListParams {
  page?: number;
  limit?: number;
  status?: string;
  office_id?: number;
  assigned_to?: string;
  category?: string;
  search?: string;
  include_closed?: boolean;
}

export interface AppointmentListParams {
  page?: number;
  limit?: number;
  status?: string;
  case_id?: number;
  assigned_to?: string;
  date_from?: string;
  date_to?: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  role?: string;
  office_id?: number;
  status?: string;
  search?: string;
}

export interface DashboardParams {
  office_id?: number;
  date_from?: string;
  date_to?: string;
}

export interface ReportParams {
  date_from?: string;
  date_to?: string;
  office_id?: number;
  user_id?: string;
}

// Response Types
export interface DashboardSummary {
  total_cases: number;
  open_cases: number;
  completed_cases: number;
  cases_this_month: number;
  total_appointments: number;
  pending_appointments: number;
  completed_appointments: number;
  appointments_today: number;
  offices?: Office[];
}

export interface StaffDashboardSummary {
  my_cases: number;
  my_open_cases: number;
  my_appointments: number;
  my_pending_appointments: number;
}

export interface CaseReport {
  totalCases: number;
  casesByStatus: Array<{ status: string; count: number }>;
  casesByPriority: Array<{ priority: string; count: number }>;
  casesByCategory: Array<{ category: string; count: number }>;
  casesByOffice: Array<{ office: string; count: number }>;
  monthlyTrends: Array<{ month: string; count: number }>;
}

export interface AppointmentReport {
  totalAppointments: number;
  appointmentsByStatus: Array<{ status: string; count: number }>;
  appointmentsByType: Array<{ type: string; count: number }>;
  dailySchedule: Array<{ date: string; count: number }>;
  staffUtilization: Array<{ staff: string; appointments: number }>;
}

export interface UserActivityReport {
  totalUsers: number;
  activeUsers: number;
  usersByRole: Array<{ role: string; count: number }>;
  loginActivity: Array<{ date: string; logins: number }>;
  caseAssignments: Array<{ user: string; cases: number }>;
}
