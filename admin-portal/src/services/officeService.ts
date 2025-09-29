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
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = '/admin/offices';
    } else if (userRole === 'office_manager') {
      endpoint = '/manager/offices';
    } else {
      endpoint = '/offices';
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data.data || response.data;
  }

  /**
   * Fetch a specific office by ID
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to fetch
   * @returns Promise<Office>
   */
  static async fetchOfficeById(userRole: UserRole, officeId: string): Promise<Office> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/offices/${officeId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/offices/${officeId}`;
    } else {
      endpoint = `/offices/${officeId}`;
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data.data || response.data;
  }

  /**
   * Create a new office
   * @param userRole - The role of the current user
   * @param officeData - The office data to create
   * @returns Promise<Office>
   */
  static async createOffice(userRole: UserRole, officeData: Partial<Office>): Promise<Office> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = '/admin/offices';
    } else if (userRole === 'office_manager') {
      endpoint = '/manager/offices';
    } else {
      throw new Error('Insufficient permissions to create offices');
    }

    const response = await apiClient.post(endpoint, officeData);
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
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/offices/${officeId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/offices/${officeId}`;
    } else {
      throw new Error('Insufficient permissions to update offices');
    }

    const response = await apiClient.patch(endpoint, officeData);
    return response.data;
  }

  /**
   * Delete an office
   * @param userRole - The role of the current user
   * @param officeId - The ID of the office to delete
   * @returns Promise<void>
   */
  static async deleteOffice(userRole: UserRole, officeId: string): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/offices/${officeId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/offices/${officeId}`;
    } else {
      throw new Error('Insufficient permissions to delete offices');
    }

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