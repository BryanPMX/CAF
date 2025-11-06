// admin-portal/src/services/appointmentService.ts
import { ApiClient } from '@/interfaces/api';
import { IAppointmentService } from '@/interfaces/services';

export class AppointmentService implements IAppointmentService {
  constructor(private apiClient: ApiClient) {}

  async getAppointments(params?: any): Promise<any> {
    // TODO: Implement
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  }

  async getAppointmentById(id: string): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async createAppointment(appointmentData: any): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async updateAppointment(id: string, appointmentData: any): Promise<any> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async deleteAppointment(id: string): Promise<void> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async getAppointmentsByCase(caseId: string): Promise<any[]> {
    // TODO: Implement
    return [];
  }
}