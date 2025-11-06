// admin-portal/src/services/appointmentService.ts
import { ApiClient } from '@/interfaces/api';
import { IAppointmentService } from '@/interfaces/services';

// Legacy service instance for backward compatibility
const legacyAppointmentService = {
  fetchAppointments: async (params?: any) => {
    console.log('Legacy fetchAppointments called with:', params);
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
  },
  deleteAppointment: async (id: string) => {
    console.log('Legacy deleteAppointment called with:', id);
    return true;
  }
};

export class AppointmentService implements IAppointmentService {
  constructor(private apiClient: ApiClient) {}

  // Backward compatibility methods (removed to avoid duplication)

  // Static methods for backward compatibility when imported as class
  static async fetchAppointments(userRole?: string, params?: any) {
    console.log('Static legacy fetchAppointments called with:', userRole, params);

    // Get API client from lib
    const { apiClient } = await import('@/app/lib/api');

    try {
      let endpoint = '/appointments';

      // Route to appropriate endpoint based on user role
      if (userRole === 'admin') {
        endpoint = '/admin/appointments';
      } else if (userRole === 'office_manager') {
        endpoint = '/office/appointments';
      }

      const response = await apiClient.get(endpoint, { params });
      return {
        data: response.data.data || response.data,
        pagination: response.data.pagination || {
          total: response.data.length || 0,
          page: params?.page || 1,
          pageSize: params?.pageSize || 20
        }
      };
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return { data: [], pagination: { total: 0, page: 1, pageSize: 20 } };
    }
  }

  static async deleteAppointment(userRole: string, id: string) {
    console.log('Static legacy deleteAppointment called with:', userRole, id);
    return true;
  }

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

// Default export for backward compatibility
export default legacyAppointmentService;