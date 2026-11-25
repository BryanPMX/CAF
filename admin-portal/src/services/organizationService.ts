import { apiClient } from "@/app/lib/api";
import type {
  Organization,
  OrganizationMembership,
  ClientOption,
  EmploymentDetails,
} from "@/app/lib/organizations";
import type { OrganizationKind } from "@/config/organizations";
export interface OrganizationClientRow {
  client: ClientOption & { phone?: string; role: string };
  membership?: OrganizationMembership | null;
  historical: boolean;
}
export interface OrganizationDetail {
  clientTotal: number;
  caseTotal: number;
  accountClient?: ClientOption & { phone?: string };
  organization: Organization;
  clients: OrganizationClientRow[];
  cases: {
    id: number;
    title: string;
    status: string;
    isArchived: boolean;
    clientId?: number;
    client?: ClientOption;
    office?: { id: number; name: string };
    employeeNumber: string;
    shiftName: string;
    shiftStart?: string;
    shiftEnd?: string;
  }[];
}
export const OrganizationService = {
  async factories(q = "", id?: number) {
    return (await apiClient.get<{data: Pick<Organization, "id" | "name">[]}>("/maquila-options", {params: {q, id}})).data.data;
  },
  async list(
    kind: OrganizationKind,
    q = "",
    page = 1,
    pageSize = 20,
    officeId?: number,
    id?: number,
  ) {
    return (
      await apiClient.get<{ data: Organization[]; total: number }>(
        "/organizations",
        { params: { kind, q, page, pageSize, officeId, id } },
      )
    ).data;
  },
  async detail(id: number, clientPage = 1, casePage = 1, clientQ = "") {
    return (
      await apiClient.get<OrganizationDetail>(`/organizations/${id}`, {
        params: { clientPage, casePage, clientQ },
      })
    ).data;
  },
  async save(
    values: Partial<Organization> & { email?: string; phone?: string },
    id?: number,
  ) {
    return (
      id
        ? await apiClient.patch(`/organizations/${id}`, values)
        : await apiClient.post("/organizations", values)
    ).data;
  },
  async memberships(clientId: number) {
    return (
      await apiClient.get<{ data: OrganizationMembership[] }>(
        `/client-organizations/${clientId}`,
      )
    ).data.data;
  },
  async clients(q = "", officeId?: number, clientType?: string) {
    return (
      await apiClient.get<{ data: ClientOption[] }>("/client-options", {
        params: { q, officeId, clientType },
      })
    ).data.data;
  },
  async link(id: number, clientId: number, employment?: EmploymentDetails, relationship?: {relationshipRoles?:string[];relationshipNotes?:string}) {
    await apiClient.post(`/organizations/${id}/clients`, {
      clientId,
      ...employment,
      ...relationship,
    });
  },
  async unlink(id: number, clientId: number) {
    await apiClient.delete(`/organizations/${id}/clients/${clientId}`);
  },
};
