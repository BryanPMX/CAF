// admin-portal/src/services/recordService.ts
// Centralized Record Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole } from '@/app/lib/types';

/**
 * Centralized service for all record-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class RecordService {
  /**
   * Fetch archive statistics
   * @param userRole - The role of the current user
   * @returns Promise<any>
   */
  static async fetchStats(userRole: UserRole): Promise<any> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = '/admin/records/stats';
    } else if (userRole === 'office_manager') {
      endpoint = '/manager/records/stats';
    } else {
      throw new Error('Insufficient permissions to view archive statistics');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Fetch archived cases
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<any>
   */
  static async fetchArchivedCases(
    userRole: UserRole,
    params: {
      page?: number;
      limit?: number;
      type?: string;
      search?: string;
    } = {}
  ): Promise<any> {
    const { page = 1, limit = 20, type = 'all', search = '' } = params;

    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      type,
    });

    if (search) {
      queryParams.set('search', search);
    }

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/records/cases?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/records/cases?${queryParams}`;
    } else {
      throw new Error('Insufficient permissions to view archived cases');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Fetch archived appointments
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<any>
   */
  static async fetchArchivedAppointments(
    userRole: UserRole,
    params: {
      page?: number;
      limit?: number;
      type?: string;
      search?: string;
    } = {}
  ): Promise<any> {
    const { page = 1, limit = 20, type = 'all', search = '' } = params;

    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      type,
    });

    if (search) {
      queryParams.set('search', search);
    }

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/records/appointments?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/records/appointments?${queryParams}`;
    } else {
      throw new Error('Insufficient permissions to view archived appointments');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Restore an archived case
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case to restore
   * @returns Promise<void>
   */
  static async restoreCase(userRole: UserRole, caseId: string): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/records/cases/${caseId}/restore`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/records/cases/${caseId}/restore`;
    } else {
      throw new Error('Insufficient permissions to restore cases');
    }

    await apiClient.post(endpoint);
  }

  /**
   * Permanently delete an archived case
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case to delete
   * @returns Promise<void>
   */
  static async permanentDeleteCase(userRole: UserRole, caseId: string): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/records/cases/${caseId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/records/cases/${caseId}`;
    } else {
      throw new Error('Insufficient permissions to permanently delete cases');
    }

    await apiClient.delete(endpoint);
  }

  /**
   * Restore an archived appointment
   * @param userRole - The role of the current user
   * @param appointmentId - The ID of the appointment to restore
   * @returns Promise<void>
   */
  static async restoreAppointment(userRole: UserRole, appointmentId: string): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/records/appointments/${appointmentId}/restore`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/records/appointments/${appointmentId}/restore`;
    } else {
      throw new Error('Insufficient permissions to restore appointments');
    }

    await apiClient.post(endpoint);
  }

  /**
   * Permanently delete an archived appointment
   * @param userRole - The role of the current user
   * @param appointmentId - The ID of the appointment to delete
   * @returns Promise<void>
   */
  static async permanentDeleteAppointment(userRole: UserRole, appointmentId: string): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/records/appointments/${appointmentId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/records/appointments/${appointmentId}`;
    } else {
      throw new Error('Insufficient permissions to permanently delete appointments');
    }

    await apiClient.delete(endpoint);
  }
}

// Export convenience functions for backward compatibility
export const {
  fetchStats,
  fetchArchivedCases,
  fetchArchivedAppointments,
  restoreCase,
  permanentDeleteCase,
  restoreAppointment,
  permanentDeleteAppointment,
} = RecordService;
