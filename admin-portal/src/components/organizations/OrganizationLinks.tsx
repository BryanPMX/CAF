"use client";
import Link from "next/link";
import { Descriptions, Tag } from "antd";
import type {
  OrganizationMembership,
  EmploymentInput,
  Organization,
} from "@/app/lib/organizations";
import { ORGANIZATION_TEXT as text } from "@/config/organizations";
export function EmploymentSummary({
  employment,
  maquila,
}: {
  employment: Partial<EmploymentInput>;
  maquila?: Pick<Organization, "id" | "name">;
}) {
  if (!employment.maquilaId) return null;
  return (
    <section
      aria-label={text.employment}
      className="my-4 rounded-lg border border-slate-200 p-4"
    >
      <h3 className="mb-3 font-semibold">{text.employment}</h3>
      <Descriptions
        size="small"
        column={{ xs: 1, sm: 2 }}
        items={[
          {
            key: "maquila",
            label: text.maquila.singular,
            children: (
              <Link
                href={`/app/maquilas?organizationId=${employment.maquilaId}`}
              >
                {maquila?.name || text.maquila.singular}
              </Link>
            ),
          },
          {
            key: "employee",
            label: text.employeeNumber,
            children: employment.employeeNumber || "—",
          },
          {
            key: "shift",
            label: text.shiftName,
            children: employment.shiftName || "—",
          },
          ...(employment.shiftStart && employment.shiftEnd
            ? [
                {
                  key: "hours",
                  label: text.shiftHours,
                  children: `${employment.shiftStart}–${employment.shiftEnd}`,
                },
              ]
            : []),
        ]}
      />
    </section>
  );
}
export default function OrganizationLinks({
  memberships,
}: {
  memberships?: OrganizationMembership[];
}) {
  if (!memberships?.length) return null;
  return (
    <section
      className="border-t border-slate-100 p-6 sm:px-8"
      aria-label={text.relatedOrganizations}
    >
      <h3 className="mb-4 text-sm font-semibold">
        {text.relatedOrganizations}
      </h3>
      <div className="space-y-3">
        {memberships.map(
          (member) =>
            member.organization && (
              <div key={member.id}>
                <Tag>
                  <Link
                    href={`/app/${member.organization.kind === "maquila" ? "maquilas" : "constructoras"}?organizationId=${member.organizationId}`}
                  >
                    {member.organization.name}
                  </Link>
                </Tag>
                {member.organization.kind === "maquila" && (
                  <p className="mt-2 text-sm text-slate-600">
                    {text.employeeNumber}: {member.employeeNumber} ·{" "}
                    {text.shiftName}: {member.shiftName}
                    {member.shiftStart && member.shiftEnd
                      ? ` (${member.shiftStart}–${member.shiftEnd})`
                      : ""}
                  </p>
                )}
              </div>
            ),
        )}
      </div>
    </section>
  );
}
