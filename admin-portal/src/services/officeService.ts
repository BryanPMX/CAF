// admin-portal/src/services/officeService.ts
// Centralized Office Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole, Office, PaginatedResponse } from '@/app/lib/types';

/**
 * Centralized service for all office-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class OfficeService {
  /**
   * Fetch offices based on user role
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<Office>>
   */
  static async fetchOffices(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ): Promise<PaginatedResponse<Office>> {
    const { page = 1, pageSize = 20, search } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
    });

    // All authenticated users can see offices list
    const endpoint = `/offices?${queryParams}`;

    const response = await apiClient.get(endpoint);
    return response.data;
  }

  /**
   * Fetch a specific office by ID
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to fetch
   * @returns Promise<Office>
   */
  static async fetchOfficeById(
    userRole: UserRole,
    officeId: string
  ): Promise<Office> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/offices/${officeId}`;
    } else {
      // Other roles cannot access individual office details
      throw new Error('Insufficient permissions to access office details');
    }

    const response = await apiClient.get(endpoint);
    return response.data;
  }

  /**
   * Create a new office (admin only)
   * @param userRole - The role of the current user
   * @param officeData - The office data to create
   * @returns Promise<Office>
   */
  static async createOffice(
    userRole: UserRole,
    officeData: Partial<Office>
  ): Promise<Office> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to create offices');
    }

    const endpoint = '/admin/offices';
    const response = await apiClient.post(endpoint, officeData);
    return response.data;
  }

  /**
   * Update an existing office (admin only)
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to update
   * @param officeData - The updated office data
   * @returns Promise<Office>
   */
  static async updateOffice(
    userRole: UserRole,
    officeId: string,
    officeData: Partial<Office>
  ): Promise<Office> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to update offices');
    }

    const endpoint = `/admin/offices/${officeId}`;
    const response = await apiClient.patch(endpoint, officeData);
    return response.data;
  }

  /**
   * Delete an office (admin only)
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to delete
   * @returns Promise<void>
   */
  static async deleteOffice(
    userRole: UserRole,
    officeId: string
  ): Promise<void> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to delete offices');
    }

    const endpoint = `/admin/offices/${officeId}`;
    await apiClient.delete(endpoint);
  }
}

// Export convenience functions for backward compatibility
export const {
  fetchOffices,
  fetchOfficeById,
  createOffice,
  updateOffice,
  deleteOffice,
} = OfficeService;
