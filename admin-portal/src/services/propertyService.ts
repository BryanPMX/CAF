import { apiClient } from "@/app/lib/api";
import type { ClientOption, Organization } from "@/app/lib/organizations";
export type PropertyKind = "land" | "block" | "lot";
export type OwnershipStatus = "reported" | "current" | "historical";
export interface PropertyOwner {
  id: number;
  clientId: number;
  client?: ClientOption;
  sharePercent?: number | null;
  status: OwnershipStatus;
  startDate?: string | null;
  endDate?: string | null;
  source: string;
}
export interface RegistryEntry {
  id: number;
  realFolio: string;
  inscription: string;
  folio: string;
  book: string;
  section: string;
  actType: string;
  instrumentNumber: string;
  instrumentDate?: string | null;
  registrationDate?: string | null;
  notary: string;
  source: string;
}
export interface PropertyDocument {
  id: number;
  fileName: string;
  fileType: string;
  createdAt: string;
}
export interface Property {
  id: number;
  officeId: number;
  office?: { id: number; name: string };
  organization?: Pick<Organization, "id" | "name">;
  organizationId?: number | null;
  parentId?: number | null;
  name: string;
  kind: PropertyKind;
  developmentName: string;
  address: string;
  state: string;
  municipality: string;
  district: string;
  block: string;
  lot: string;
  cadastralKey: string;
  areaM2?: number | null;
  notes: string;
  owners: PropertyOwner[];
  registryEntries: RegistryEntry[];
  documents?: PropertyDocument[];
}
export type PropertyInput = Omit<
  Property,
  "id" | "owners" | "registryEntries" | "documents" | "office" | "organization"
> & { initialOwnerId?: number };
export interface PropertyFilters {
  q?: string;
  page?: number;
  pageSize?: number;
  organizationId?: number;
  clientId?: number;
  officeId?: number;
}
export const PropertyService = {
  async list(params: PropertyFilters) {
    return (
      await apiClient.get<{ data: Property[]; total: number }>("/properties", {
        params,
      })
    ).data;
  },
  async get(id: number) {
    return (await apiClient.get<Property>(`/properties/${id}`)).data;
  },
  async save(input: PropertyInput, id?: number) {
    return (
      id
        ? await apiClient.put<Property>(`/properties/${id}`, input)
        : await apiClient.post<Property>("/properties", input)
    ).data;
  },
  async owner(
    propertyId: number,
    input: Omit<PropertyOwner, "id" | "client">,
    id?: number,
  ) {
    return (
      id
        ? await apiClient.put<Property>(
            `/properties/${propertyId}/owners/${id}`,
            input,
          )
        : await apiClient.post<Property>(
            `/properties/${propertyId}/owners`,
            input,
          )
    ).data;
  },
  async registry(
    propertyId: number,
    input: Omit<RegistryEntry, "id">,
    id?: number,
  ) {
    return (
      id
        ? await apiClient.put<Property>(
            `/properties/${propertyId}/registry/${id}`,
            input,
          )
        : await apiClient.post<Property>(
            `/properties/${propertyId}/registry`,
            input,
          )
    ).data;
  },
  async upload(propertyId: number, file: File) {
    const body = new FormData();
    body.append("file", file);
    await apiClient.post(`/properties/${propertyId}/documents`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  async download(propertyId: number, document: PropertyDocument) {
    const response = await apiClient.get(
      `/properties/${propertyId}/documents/${document.id}`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(response.data);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = document.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
export const PROPERTY_KINDS = [
  { value: "land", label: "Terreno" },
  { value: "block", label: "Manzana" },
  { value: "lot", label: "Lote" },
];
export const OWNERSHIP_STATES = [
  { value: "reported", label: "Por confirmar" },
  { value: "current", label: "Actual" },
  { value: "historical", label: "Histórico" },
];
export const propertyError = (error: unknown) =>
  (error as { response?: { data?: { error?: string } } })?.response?.data
    ?.error || "No fue posible guardar o consultar la propiedad.";
export const dateOnly = (date?: string | null) =>
  date ? date.slice(0, 10) : "";

export function formatRegistryDate(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = dateOnly(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
