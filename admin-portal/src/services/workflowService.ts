import { apiClient } from '@/app/lib/api';
import type { UserRole } from '@/app/lib/types';
import { getAppointmentsEndpoint, getCasesEndpoint, getEndpointGroup } from '@/app/lib/api-endpoints';

export interface WorkflowOffice {
  id: number;
  name: string;
}

export interface WorkflowUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  department?: string;
  officeId?: number;
}

export interface WorkflowCase {
  id: number;
  title: string;
  category?: string;
  status?: string;
}

function assertEmployee(role: UserRole): void {
  if (role === 'client') {
    throw new Error('Los clientes no pueden administrar casos o citas desde este portal.');
  }
}

function rolePrefix(role: UserRole): '/admin' | '/manager' | '/staff' {
  const group = getEndpointGroup(role);
  return group === 'admin' ? '/admin' : group === 'manager' ? '/manager' : '/staff';
}

function listFromResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const record = payload as { data?: unknown; users?: unknown; cases?: unknown };
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.users)) return record.users as T[];
    if (Array.isArray(record.cases)) return record.cases as T[];
  }
  return [];
}

/** Central API boundary for employee case and appointment creation workflows. */
export const WorkflowService = {
  async listOffices(role: UserRole): Promise<WorkflowOffice[]> {
    assertEmployee(role);
    const endpoint = role === 'admin' || role === 'office_manager'
      ? `${rolePrefix(role)}/offices`
      : '/offices';
    const response = await apiClient.get(endpoint);
    return listFromResponse<WorkflowOffice>(response.data);
  },

  async listStaff(role: UserRole): Promise<WorkflowUser[]> {
    assertEmployee(role);
    const response = await apiClient.get(`${rolePrefix(role)}/users`, {
      params: { page: 1, pageSize: 200 },
    });
    return listFromResponse<WorkflowUser>(response.data).filter((member) => member.role !== 'client');
  },

  async listClients(role: UserRole, query = '', limit = 10): Promise<WorkflowUser[]> {
    assertEmployee(role);
    const response = await apiClient.get(`${rolePrefix(role)}/users`, {
      params: { role: 'client', q: query || undefined, page: 1, pageSize: limit, limit },
    });
    return listFromResponse<WorkflowUser>(response.data);
  },

  async listClientCases(role: UserRole, clientId: number): Promise<WorkflowCase[]> {
    assertEmployee(role);
    const response = await apiClient.get(`${rolePrefix(role)}/clients/${clientId}/cases-for-appointment`);
    return listFromResponse<WorkflowCase>(response.data);
  },

  async createCase(role: UserRole, payload: unknown): Promise<void> {
    assertEmployee(role);
    await apiClient.post(getCasesEndpoint(role, 'create'), payload);
  },

  async createAppointment(role: UserRole, payload: unknown): Promise<void> {
    assertEmployee(role);
    await apiClient.post(getAppointmentsEndpoint(role, 'create'), payload);
  },
};
