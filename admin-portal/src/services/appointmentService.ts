// admin-portal/src/services/appointmentService.ts
// Centralized Appointment Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole, Appointment, PaginatedResponse, SearchFilters } from '@/app/lib/types';

/**
 * Centralized service for all appointment-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class AppointmentService {
  /**
   * Fetch appointments based on user role
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<Appointment>>
   */
  static async fetchAppointments(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: SearchFilters;
    } = {}
  ): Promise<PaginatedResponse<Appointment>> {
    const { page = 1, pageSize = 20, search, filters = {} } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.category && { category: filters.category }),
      ...(filters.department && { department: filters.department }),
      ...(filters.assignedTo && { assignedTo: filters.assignedTo.toString() }),
      ...(filters.officeId && { officeId: filters.officeId.toString() }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
    });

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      // Admin users get optimized endpoint with full access
      endpoint = `/admin/optimized/appointments?${queryParams}`;
    } else if (userRole === 'office_manager') {
      // Office managers use manager endpoints
      endpoint = `/manager/appointments?${queryParams}`;
    } else {
      // Staff roles use staff endpoints
      endpoint = `/staff/appointments?${queryParams}`;
    }

    const response = await apiClient.get(endpoint);
    // Return the full response structure with data, pagination, and performance
    return response.data;
  }

  /**
   * Fetch a specific appointment by ID
   * @param userRole - The role of the current user
   * @param appointmentId - The ID of the appointment to fetch
   * @param include - Additional data to include
   * @returns Promise<Appointment>
   */
  static async fetchAppointmentById(
    userRole: UserRole,
    appointmentId: string,
    include?: string
  ): Promise<Appointment> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (include) {
      queryParams.append('include', include);
    }

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/appointments/${appointmentId}?${queryParams}`;
    } else {
      endpoint = `/appointments/${appointmentId}?${queryParams}`;
    }

    const response = await apiClient.get(endpoint);
    // Return the full response structure with data, pagination, and performance
    return response.data;
  }

  /**
   * Create a new appointment
   * @param userRole - The role of the current user
   * @param appointmentData - The appointment data to create
   * @returns Promise<Appointment>
   */
  static async createAppointment(
    userRole: UserRole,
    appointmentData: Partial<Appointment>
  ): Promise<Appointment> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = '/admin/appointments';
    } else {
      endpoint = '/appointments';
    }

    const response = await apiClient.post(endpoint, appointmentData);
    return response.data;
  }

  /**
   * Update an existing appointment
   * @param userRole - The role of the current user
   * @param appointmentId - The ID of the appointment to update
   * @param appointmentData - The updated appointment data
   * @returns Promise<Appointment>
   */
  static async updateAppointment(
    userRole: UserRole,
    appointmentId: string,
    appointmentData: Partial<Appointment>
  ): Promise<Appointment> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/appointments/${appointmentId}`;
    } else {
      endpoint = `/appointments/${appointmentId}`;
    }

    const response = await apiClient.patch(endpoint, appointmentData);
    return response.data;
  }

  /**
   * Delete an appointment
   * @param userRole - The role of the current user
   * @param appointmentId - The ID of the appointment to delete
   * @returns Promise<void>
   */
  static async deleteAppointment(
    userRole: UserRole,
    appointmentId: string
  ): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/appointments/${appointmentId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/appointments/${appointmentId}`;
    } else {
      endpoint = `/staff/appointments/${appointmentId}`;
    }

    await apiClient.delete(endpoint);
  }

  /**
   * Fetch appointments assigned to the current user
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<Appointment>>
   */
  static async fetchMyAppointments(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: SearchFilters;
    } = {}
  ): Promise<PaginatedResponse<Appointment>> {
    const { page = 1, pageSize = 20, search, filters = {} } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.category && { category: filters.category }),
    });

    // All roles use the same endpoint for "my appointments"
    const endpoint = `/appointments/my?${queryParams}`;

    const response = await apiClient.get(endpoint);
    // Return the full response structure with data, pagination, and performance
    return response.data;
  }

  /**
   * Get client cases for appointment creation
   * @param userRole - The role of the current user
   * @param clientId - The ID of the client
   * @returns Promise<Case[]>
   */
  static async fetchClientCasesForAppointment(
    userRole: UserRole,
    clientId: string
  ): Promise<any[]> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/clients/${clientId}/cases-for-appointment`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/clients/${clientId}/cases-for-appointment`;
    } else {
      endpoint = `/clients/${clientId}/cases-for-appointment`;
    }

    const response = await apiClient.get(endpoint);
    // Return the full response structure with data, pagination, and performance
    return response.data;
  }

  /**
   * Create a smart appointment (with automatic conflict detection)
   * @param userRole - The role of the current user
   * @param appointmentData - The appointment data to create
   * @returns Promise<Appointment>
   */
  static async createSmartAppointment(
    userRole: UserRole,
    appointmentData: Partial<Appointment>
  ): Promise<Appointment> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = '/admin/appointments';
    } else if (userRole === 'office_manager') {
      endpoint = '/manager/appointments';
    } else {
      endpoint = '/appointments';
    }

    const response = await apiClient.post(endpoint, appointmentData);
    return response.data;
  }
}

// Export convenience functions for backward compatibility
export const {
  fetchAppointments,
  fetchAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  fetchMyAppointments,
  fetchClientCasesForAppointment,
  createSmartAppointment,
} = AppointmentService;
