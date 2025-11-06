// admin-portal/src/services/officeService.ts
import { ApiClient } from '@/interfaces/api';
import { IOfficeService } from '@/interfaces/services';

export class OfficeService implements IOfficeService {
  constructor(private apiClient: ApiClient) {}

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