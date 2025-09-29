// admin-portal/src/services/reportService.ts
// Centralized Report Data Access Layer

import { apiClient } from '@/app/lib/api';
import { UserRole } from '@/app/lib/types';

/**
 * Centralized service for all report-related data operations
 * Implements role-based endpoint routing to ensure correct API access
 */
export class ReportService {
  /**
   * Fetch offices for report filtering
   * @param userRole - The role of the current user
   * @returns Promise<any[]>
   */
  static async fetchOfficesForReports(userRole: UserRole): Promise<any[]> {
    // All roles can access offices for filtering
    const response = await apiClient.get('/offices');
    return response.data;
  }

  /**
   * Generate a cases report
   * @param userRole - The role of the current user
   * @param params - Query parameters for the report
   * @returns Promise<any>
   */
  static async generateCasesReport(
    userRole: UserRole,
    params: {
      dateFrom?: string;
      dateTo?: string;
      officeId?: string;
      caseStatus?: string;
    } = {}
  ): Promise<any> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.officeId) queryParams.append('officeId', params.officeId);
    if (params.caseStatus) queryParams.append('caseStatus', params.caseStatus);

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/reports/cases-report?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/reports/cases-report?${queryParams}`;
    } else {
      throw new Error('Insufficient permissions to generate cases reports');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data.data || response.data;
  }

  /**
   * Generate an appointments report
   * @param userRole - The role of the current user
   * @param params - Query parameters for the report
   * @returns Promise<any>
   */
  static async generateAppointmentsReport(
    userRole: UserRole,
    params: {
      dateFrom?: string;
      dateTo?: string;
      officeId?: string;
      appointmentStatus?: string;
    } = {}
  ): Promise<any> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.officeId) queryParams.append('officeId', params.officeId);
    if (params.appointmentStatus) queryParams.append('appointmentStatus', params.appointmentStatus);

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/reports/appointments-report?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/reports/appointments-report?${queryParams}`;
    } else {
      throw new Error('Insufficient permissions to generate appointments reports');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data.data || response.data;
  }

  /**
   * Generate a summary report
   * @param userRole - The role of the current user
   * @param params - Query parameters for the report
   * @returns Promise<any>
   */
  static async generateSummaryReport(
    userRole: UserRole,
    params: {
      dateFrom?: string;
      dateTo?: string;
      officeId?: string;
    } = {}
  ): Promise<any> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.officeId) queryParams.append('officeId', params.officeId);

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/reports/summary-report?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/reports/summary-report?${queryParams}`;
    } else {
      throw new Error('Insufficient permissions to generate summary reports');
    }

    const response = await apiClient.get(endpoint);
    // Admin optimized endpoints wrap data in a data property
    return response.data.data || response.data;
  }

  /**
   * Export a report
   * @param userRole - The role of the current user
   * @param format - Export format (excel or pdf)
   * @param params - Query parameters for the export
   * @returns Promise<Blob>
   */
  static async exportReport(
    userRole: UserRole,
    format: 'excel' | 'pdf',
    params: {
      dateFrom?: string;
      dateTo?: string;
      officeId?: string;
      reportType?: string;
    } = {}
  ): Promise<Blob> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.officeId) queryParams.append('officeId', params.officeId);
    if (params.reportType) queryParams.append('reportType', params.reportType);
    queryParams.append('format', format);

    // Determine endpoint based on role
    let endpoint: string;
    
    if (userRole === 'admin') {
      endpoint = `/admin/reports/export?${queryParams}`;
    } else if (userRole === 'office_manager') {
      endpoint = `/manager/reports/export?${queryParams}`;
    } else {
      throw new Error('Insufficient permissions to export reports');
    }

    const response = await apiClient.get(endpoint, {
      responseType: 'blob',
    });
    return response.data;
  }
}

// Export convenience functions for backward compatibility
export const {
  fetchOfficesForReports,
  generateCasesReport,
  generateAppointmentsReport,
  generateSummaryReport,
  exportReport,
} = ReportService;
