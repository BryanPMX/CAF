// admin-portal/src/services/caseService.ts
import { ApiClient } from '@/interfaces/api';
import {
  ICaseService,
  CreateCaseRequest,
  UpdateCaseRequest,
  CaseListParams,
  PaginatedResponse
} from '@/interfaces/services';
import { Case } from '@/app/lib/types';

// Legacy service class for backward compatibility
export class LegacyCaseService {
  // Keep existing methods for backward compatibility
  async fetchCases(params?: any) {
    console.log('Legacy fetchCases called with:', params);
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  }

  async fetchCaseById(id: string) {
    console.log('Legacy fetchCaseById called with:', id);
    return { id, title: 'Mock Case', description: 'Mock description' };
  }

  async deleteCase(id: string) {
    console.log('Legacy deleteCase called with:', id);
    return true;
  }
}

export class CaseService implements ICaseService {
  constructor(private apiClient: ApiClient) {}

  // Static methods for backward compatibility when imported as class
  static async fetchCases(params?: any) {
    console.log('Static legacy fetchCases called with:', params);
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  }

  static async fetchCaseById(userRole: string, id: string, options?: string) {
    console.log('Static legacy fetchCaseById called with:', userRole, id, options);
    return { id, title: 'Mock Case', description: 'Mock description' };
  }

  static async deleteCase(userRole: string, id: string) {
    console.log('Static legacy deleteCase called with:', userRole, id);
    return true;
  }

  async getCases(params?: CaseListParams): Promise<PaginatedResponse<Case>> {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.office_id) queryParams.append('office_id', params.office_id.toString());
    if (params?.assigned_to) queryParams.append('assigned_to', params.assigned_to);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.include_closed) queryParams.append('include_closed', 'true');

    const url = `/cases${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.apiClient.get<PaginatedResponse<Case>>(url);

    if (!response.success) {
      throw new Error('Failed to fetch cases');
    }

    return response.data;
  }

  async getCaseById(id: string): Promise<Case> {
    const response = await this.apiClient.get<Case>(`/cases/${id}`);

    if (!response.success) {
      throw new Error('Failed to fetch case');
    }

    return response.data;
  }

  async createCase(caseData: CreateCaseRequest): Promise<Case> {
    const response = await this.apiClient.post<Case>('/cases', caseData);

    if (!response.success) {
      throw new Error('Failed to create case');
    }

    return response.data;
  }

  async updateCase(id: string, caseData: UpdateCaseRequest): Promise<Case> {
    const response = await this.apiClient.put<Case>(`/cases/${id}`, caseData);

    if (!response.success) {
      throw new Error('Failed to update case');
    }

    return response.data;
  }

  async deleteCase(id: string): Promise<void> {
    const response = await this.apiClient.delete<void>(`/cases/${id}`);

    if (!response.success) {
      throw new Error('Failed to delete case');
    }
  }

  async archiveCase(id: string): Promise<Case> {
    const response = await this.apiClient.patch<Case>(`/cases/${id}/archive`, {});

    if (!response.success) {
      throw new Error('Failed to archive case');
    }

    return response.data;
  }

  async getCasesAssignedToUser(userId: string): Promise<Case[]> {
    const response = await this.apiClient.get<Case[]>(`/users/${userId}/cases`);

    if (!response.success) {
      throw new Error('Failed to fetch user cases');
    }

    return response.data;
  }
}

// Legacy export for backward compatibility
export const caseService = new LegacyCaseService();

// Default export for backward compatibility
export default caseService;