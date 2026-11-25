import type { OrganizationKind } from "@/config/organizations";
export interface EmploymentDetails {
  employeeNumber: string;
  shiftName: string;
  shiftStart?: string;
  shiftEnd?: string;
}
export interface EmploymentInput extends EmploymentDetails {
  maquilaId?: number | null;
}
export interface Organization {
  id: number;
  kind: OrganizationKind;
  officeId?: number | null;
  office?: { id: number; name: string };
  name: string;
  legalName?: string;
  tradeName?: string;
  legalRepresentative: string;
  legalAddress: string;
  boardPresident: string;
  neighborhood: string;
  accountClientId?: number | null;
}
export interface OrganizationMembership extends EmploymentDetails {
  relationshipRoles?: string[];
  relationshipNotes?: string;
  id: number;
  organizationId: number;
  clientId: number;
  organization?: Organization;
}
export interface ClientOption {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  clientType?: "person" | "organization";
  officeId?: number | null;
  office?: { id: number; name: string };
}
export const clientLabel = (
  client: Pick<ClientOption, "firstName" | "lastName">,
) => [client.firstName, client.lastName].filter(Boolean).join(" ");
export const employmentFromMemberships = (
  memberships?: OrganizationMembership[],
): EmploymentInput => {
  const current = memberships?.find(
    (link) => link.organization?.kind === "maquila",
  );
  return current
    ? {
        maquilaId: current.organizationId,
        employeeNumber: current.employeeNumber,
        shiftName: current.shiftName,
        shiftStart: current.shiftStart || "",
        shiftEnd: current.shiftEnd || "",
      }
    : {
        maquilaId: null,
        employeeNumber: "",
        shiftName: "",
        shiftStart: "",
        shiftEnd: "",
      };
};
