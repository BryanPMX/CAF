// admin-portal/src/services/officeService.ts
import { ApiClient } from '@/interfaces/api';
import { IOfficeService } from '@/interfaces/services';

export class OfficeService implements IOfficeService {
  constructor(private apiClient: ApiClient) {}

  // Static methods for backward compatibility
  static async fetchOffices(userRole: string) {
    console.log('Static legacy fetchOffices called with:', userRole);

    // Get API client from lib
    const { apiClient } = await import('@/app/lib/api');

    try {
      let endpoint = '/offices';

      // Route to appropriate endpoint based on user role
      if (userRole === 'admin') {
        endpoint = '/admin/offices';
      } else if (userRole === 'office_manager') {
        endpoint = '/office/offices';
      }

      const response = await apiClient.get(endpoint);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching offices:', error);
      return [];
    }
  }

  static async deleteOffice(userRole: string, id: string) {
    console.log('Static legacy deleteOffice called with:', userRole, id);
    return true;
  }

  async getOffices(): Promise<any[]> {
    // TODO: Implement
    return [];
  }

  async getOfficeById(id: string): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async createOffice(officeData: any): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async updateOffice(id: string, updates: any): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async deleteOffice(id: string): Promise<void> {
    // TODO: Implement
    throw new Error('Not implemented');
  }
}