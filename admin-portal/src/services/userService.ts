// admin-portal/src/services/userService.ts
// Centralized User Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole, User, PaginatedResponse, SearchFilters } from '@/app/lib/types';

/**
 * Centralized service for all user-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class UserService {
  /**
   * Fetch users based on user role
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<User>>
   */
  static async fetchUsers(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: SearchFilters;
    } = {}
  ): Promise<PaginatedResponse<User>> {
    const { page = 1, pageSize = 20, search, filters = {} } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
      ...(filters.officeId && { officeId: filters.officeId.toString() }),
    });

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      // Admin users get optimized endpoint with full access
      endpoint = `/admin/optimized/users?${queryParams}`;
    } else if (userRole === 'office_manager') {
      // Office managers can see users in their office
      endpoint = `/manager/users?${queryParams}`;
    } else {
      // Other roles cannot access user management
      throw new Error('Insufficient permissions to access user data');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Fetch a specific user by ID
   * @param userRole - The role of the current user
   * @param userId - The ID of the user to fetch
   * @returns Promise<User>
   */
  static async fetchUserById(
    userRole: UserRole,
    userId: string
  ): Promise<User> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/users/${userId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/users/${userId}`;
    } else {
      throw new Error('Insufficient permissions to access user data');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Create a new user (admin only)
   * @param userRole - The role of the current user
   * @param userData - The user data to create
   * @returns Promise<User>
   */
  static async createUser(
    userRole: UserRole,
    userData: Partial<User>
  ): Promise<User> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to create users');
    }

    const endpoint = '/admin/users';
    const response = await apiClient.post(endpoint, userData);
    return response.data;
  }

  /**
   * Update an existing user
   * @param userRole - The role of the current user
   * @param userId - The ID of the user to update
   * @param userData - The updated user data
   * @returns Promise<User>
   */
  static async updateUser(
    userRole: UserRole,
    userId: string,
    userData: Partial<User>
  ): Promise<User> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/users/${userId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/users/${userId}`;
    } else {
      throw new Error('Insufficient permissions to update users');
    }

    const response = await apiClient.patch(endpoint, userData);
    return response.data;
  }

  /**
   * Delete a user (admin only)
   * @param userRole - The role of the current user
   * @param userId - The ID of the user to delete
   * @returns Promise<void>
   */
  static async deleteUser(
    userRole: UserRole,
    userId: string
  ): Promise<void> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to delete users');
    }

    const endpoint = `/admin/users/${userId}`;
    await apiClient.delete(endpoint);
  }

  /**
   * Permanently delete a user (admin only)
   * @param userRole - The role of the current user
   * @param userId - The ID of the user to permanently delete
   * @returns Promise<void>
   */
  static async permanentDeleteUser(
    userRole: UserRole,
    userId: string
  ): Promise<void> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to permanently delete users');
    }

    const endpoint = `/admin/users/${userId}/permanent`;
    await apiClient.delete(endpoint);
  }

  /**
   * Search for clients (for appointment creation, etc.)
   * @param userRole - The role of the current user
   * @param searchTerm - The search term
   * @returns Promise<User[]>
   */
  static async searchClients(
    userRole: UserRole,
    searchTerm: string
  ): Promise<User[]> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to search clients');
    }

    const endpoint = `/admin/users/search?q=${encodeURIComponent(searchTerm)}`;
    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }

  /**
   * Get current user profile
   * @returns Promise<User>
   */
  static async getCurrentUserProfile(): Promise<User> {
    const endpoint = '/profile';
    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data;
  }
}

// Export convenience functions for backward compatibility
export const {
  fetchUsers,
  fetchUserById,
  createUser,
  updateUser,
  deleteUser,
  permanentDeleteUser,
  searchClients,
  getCurrentUserProfile,
} = UserService;
