// admin-portal/src/services/dashboardService.ts
import { ApiClient } from '@/interfaces/api';
import { IDashboardService } from '@/interfaces/services';

export class DashboardService implements IDashboardService {
  constructor(private apiClient: ApiClient) {}

  async getDashboardSummary(params?: any): Promise<any> {
    // TODO: Implement
    return {
      total_cases: 0,
      open_cases: 0,
      completed_cases: 0,
      cases_this_month: 0,
      total_appointments: 0,
      pending_appointments: 0,
      completed_appointments: 0,
      appointments_today: 0,
      offices: []
    };
  }

  async getStaffDashboard(): Promise<any> {
    // TODO: Implement
    return {
      my_cases: 0,
      my_open_cases: 0,
      my_appointments: 0,
      my_pending_appointments: 0
    };
  }
}
