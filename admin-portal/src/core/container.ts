// admin-portal/src/core/container.ts
import { ApiClient, ApiClientImpl } from '@/abstractions/httpClient';
import { AxiosHttpClient } from '@/abstractions/httpClient';
import {
  ICaseService,
  IAppointmentService,
  IUserService,
  IOfficeService,
  IDashboardService,
  IReportService,
} from '@/interfaces/services';
import { CaseService } from '@/services/caseService';
import { AppointmentService } from '@/services/appointmentService';
import { UserService } from '@/services/userService';
import { OfficeService } from '@/services/officeService';
import { DashboardService } from '@/services/dashboardService';
// Service Container for Dependency Injection
export class ServiceContainer {
  private apiClient: ApiClient;
  private caseService: ICaseService;
  private appointmentService: IAppointmentService;
  private userService: IUserService;
  private officeService: IOfficeService;
  private dashboardService: IDashboardService;
  private reportService: IReportService;

  constructor(apiBaseUrl: string = '/api/v1') {
    // Initialize HTTP client and API client
    const httpClient = new AxiosHttpClient(apiBaseUrl);
    this.apiClient = new ApiClientImpl(httpClient);

    // Initialize services with their dependencies
    this.caseService = new CaseService(this.apiClient);
    this.appointmentService = new AppointmentService(this.apiClient);
    this.userService = new UserService(this.apiClient);
    this.officeService = new OfficeService(this.apiClient);
    this.dashboardService = new DashboardService(this.apiClient);
    // TODO: Implement proper ReportService
    this.reportService = {
      getCaseReports: async () => ({} as any),
      getAppointmentReports: async () => ({} as any),
      getUserActivityReports: async () => ({} as any),
      exportReport: async () => new Blob(),
    } as unknown as IReportService;
  }

  // Getters for services
  getCaseService(): ICaseService {
    return this.caseService;
  }

  getAppointmentService(): IAppointmentService {
    return this.appointmentService;
  }

  getUserService(): IUserService {
    return this.userService;
  }

  getOfficeService(): IOfficeService {
    return this.officeService;
  }

  getDashboardService(): IDashboardService {
    return this.dashboardService;
  }

  getReportService(): IReportService {
    return this.reportService;
  }

  // Get the API client (for testing or advanced usage)
  getApiClient(): ApiClient {
    return this.apiClient;
  }
}

// Global container instance
let globalContainer: ServiceContainer | null = null;

// Get or create the global service container
export function getServiceContainer(): ServiceContainer {
  if (!globalContainer) {
    globalContainer = new ServiceContainer();
  }
  return globalContainer;
}

// Helper functions to get services
export function getCaseService(): ICaseService {
  return getServiceContainer().getCaseService();
}

export function getAppointmentService(): IAppointmentService {
  return getServiceContainer().getAppointmentService();
}

export function getUserService(): IUserService {
  return getServiceContainer().getUserService();
}

export function getOfficeService(): IOfficeService {
  return getServiceContainer().getOfficeService();
}

export function getDashboardService(): IDashboardService {
  return getServiceContainer().getDashboardService();
}

export function getReportService(): IReportService {
  return getServiceContainer().getReportService();
}
