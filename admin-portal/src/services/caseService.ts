// admin-portal/src/services/caseService.ts
// Centralized Case Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole, Case, CaseDetails, PaginatedResponse, EnhancedPaginatedResponse, SearchFilters } from '@/app/lib/types';

/**
 * Centralized service for all case-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class CaseService {
  /**
   * Fetch cases based on user role
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<EnhancedPaginatedResponse<Case>>
   */
  static async fetchCases(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: SearchFilters;
    } = {}
  ): Promise<EnhancedPaginatedResponse<Case>> {
    const { page = 1, pageSize = 20, search, filters = {} } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.category && { category: filters.category }),
      ...(filters.title && { title: filters.title }),
      ...(filters.department && { department: filters.department }),
      ...(filters.assignedTo && { assignedTo: filters.assignedTo.toString() }),
      ...(filters.officeId && { officeId: filters.officeId.toString() }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
    });

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      // Admin users use standard admin endpoint for consistency
      endpoint = `/admin/cases?${queryParams}`;
    } else if (userRole === 'office_manager') {
      // Office managers use manager endpoints
      endpoint = `/manager/cases?${queryParams}`;
    } else {
      // Staff roles use staff endpoints
      endpoint = `/staff/cases?${queryParams}`;
    }

    const response = await apiClient.get(endpoint);
    // Return the full response structure with data, pagination, and performance
    return response.data;
  }

  /**
   * Fetch a specific case by ID
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case to fetch
   * @param include - Additional data to include (e.g., 'full' for complete case details)
   * @returns Promise<CaseDetails>
   */
  static async fetchCaseById(
    userRole: UserRole,
    caseId: string,
    include?: string
  ): Promise<CaseDetails> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (include) {
      queryParams.append('include', include);
    }

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/cases/${caseId}?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/cases/${caseId}?${queryParams}`;
    } else {
      endpoint = `/staff/cases/${caseId}?${queryParams}`;
    }

    const response = await apiClient.get(endpoint);
    // Backend returns case wrapped in a data property: { data: caseData }
    return response.data.data || response.data;
  }

  /**
   * Create a new case
   * @param userRole - The role of the current user
   * @param caseData - The case data to create
   * @returns Promise<Case>
   */
  static async createCase(
    userRole: UserRole,
    caseData: Partial<Case>
  ): Promise<Case> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = '/admin/cases';
    } else if (userRole === 'office_manager') {
      endpoint = '/manager/cases';
    } else {
      endpoint = '/staff/cases';
    }

    const response = await apiClient.post(endpoint, caseData);
    return response.data;
  }

  /**
   * Update an existing case
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case to update
   * @param caseData - The updated case data
   * @returns Promise<CaseDetails>
   */
  static async updateCase(
    userRole: UserRole,
    caseId: string,
    caseData: Partial<Case>
  ): Promise<CaseDetails> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/cases/${caseId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/cases/${caseId}`;
    } else {
      endpoint = `/staff/cases/${caseId}`;
    }

    const response = await apiClient.put(endpoint, caseData);
    return response.data;
  }

  /**
   * Delete a case
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case to delete
   * @returns Promise<void>
   */
  static async deleteCase(
    userRole: UserRole,
    caseId: string
  ): Promise<void> {
    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/cases/${caseId}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/cases/${caseId}`;
    } else {
      endpoint = `/staff/cases/${caseId}`;
    }

    await apiClient.delete(endpoint);
  }

  /**
   * Fetch cases assigned to the current user
   * @param userRole - The role of the current user
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<EnhancedPaginatedResponse<Case>>
   */
  static async fetchMyCases(
    userRole: UserRole,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: SearchFilters;
    } = {}
  ): Promise<EnhancedPaginatedResponse<Case>> {
    const { page = 1, pageSize = 20, search, filters = {} } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search && { search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.category && { category: filters.category }),
    });

    // All roles use the same endpoint for "my cases"
    const endpoint = `/cases/my?${queryParams}`;

    const response = await apiClient.get(endpoint);
    // Return the full response structure with data, pagination, and performance
    return response.data;
  }

  /**
   * Update case stage (admin only)
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case
   * @param stage - The new stage
   * @returns Promise<CaseDetails>
   */
  static async updateCaseStage(
    userRole: UserRole,
    caseId: string,
    stage: string
  ): Promise<CaseDetails> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to update case stage');
    }

    const endpoint = `/admin/cases/${caseId}/stage`;
    const response = await apiClient.patch(endpoint, { stage });
    return response.data;
  }

  /**
   * Assign staff to case (admin only)
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case
   * @param staffId - The ID of the staff member to assign
   * @returns Promise<CaseDetails>
   */
  static async assignStaffToCase(
    userRole: UserRole,
    caseId: string,
    staffId: number
  ): Promise<CaseDetails> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to assign staff to case');
    }

    const endpoint = `/admin/cases/${caseId}/assign`;
    const response = await apiClient.post(endpoint, { staffId });
    return response.data;
  }

  /**
   * Complete a case (admin only)
   * @param userRole - The role of the current user
   * @param caseId - The ID of the case
   * @returns Promise<CaseDetails>
   */
  static async completeCase(
    userRole: UserRole,
    caseId: string
  ): Promise<CaseDetails> {
    if (userRole !== 'admin') {
      throw new Error('Insufficient permissions to complete case');
    }

    const endpoint = `/admin/cases/${caseId}/complete`;
    const response = await apiClient.post(endpoint);
    return response.data;
  }

  /**
   * Get cases for a specific client
   * @param userRole - The role of the current user
   * @param clientId - The ID of the client
   * @param params - Query parameters for filtering and pagination
   * @returns Promise<EnhancedPaginatedResponse<Case>>
   */
  static async fetchCasesForClient(
    userRole: UserRole,
    clientId: string,
    params: {
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<EnhancedPaginatedResponse<Case>> {
    const { page = 1, pageSize = 20 } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString(),
    });

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/clients/${clientId}/cases?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/clients/${clientId}/cases?${queryParams}`;
    } else {
      endpoint = `/staff/clients/${clientId}/cases?${queryParams}`;
    }

    const response = await apiClient.get(endpoint);
    // Return the full response structure with data, pagination, and performance
    return response.data;
  }
}

// Export convenience functions for backward compatibility
export const {
  fetchCases,
  fetchCaseById,
  createCase,
  updateCase,
  deleteCase,
  fetchMyCases,
  updateCaseStage,
  assignStaffToCase,
  completeCase,
  fetchCasesForClient,
} = CaseService;
