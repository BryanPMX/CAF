// admin-portal/src/services/officeService.ts
// Centralized Office Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole, Office } from '@/app/lib/types';

/**
 * Centralized service for all office-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class OfficeService {
  /**
   * Fetch all offices
   * @param userRole - The role of the current user
   * @returns Promise<Office[]>
   */
  static async fetchOffices(userRole: UserRole): Promise<Office[]> {
    // Use protected endpoint for all authenticated users (admin routes removed)
    const endpoint = '/offices';

    const response = await apiClient.get(endpoint);
    return response.data;
  }

  /**
   * Fetch a specific office by ID
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to fetch
   * @returns Promise<Office>
   */
  static async fetchOfficeById(userRole: UserRole, officeId: string): Promise<Office> {
    // Use protected endpoint for all authenticated users (admin routes removed)
    const endpoint = `/offices/${officeId}`;

    const response = await apiClient.get(endpoint);
    return response.data;
  }

  /**
   * Create a new office
   * @param userRole - The role of the current user
   * @param officeData - The office data to create
   * @returns Promise<Office>
   */
  static async createOffice(userRole: UserRole, officeData: Partial<Office>): Promise<Office> {
    // Only admins can create offices (admin routes removed, so this might not be available)
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to create offices');
    }

    // Use admin endpoint (may not be available after admin section removal)
    const response = await apiClient.post('/admin/offices', officeData);
    return response.data;
  }

  /**
   * Update an existing office
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to update
   * @param officeData - The updated office data
   * @returns Promise<Office>
   */
  static async updateOffice(userRole: UserRole, officeId: string, officeData: Partial<Office>): Promise<Office> {
    // Only admins can update offices (admin routes still available in backend)
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to update offices');
    }

    const response = await apiClient.patch(`/admin/offices/${officeId}`, officeData);
    return response.data;
  }

  /**
   * Delete an office
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to delete
   * @returns Promise<void>
   */
  static async deleteOffice(userRole: UserRole, officeId: string): Promise<void> {
    // Only admins can delete offices (admin routes still available in backend)
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to delete offices');
    }

    await apiClient.delete(`/admin/offices/${officeId}`);
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