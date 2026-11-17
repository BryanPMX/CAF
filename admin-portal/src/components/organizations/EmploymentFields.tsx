"use client";
import { useEffect, useState } from "react";
import { AutoComplete, Form, Input, Select } from "antd";
import { OrganizationService } from "@/services/organizationService";
import type { Organization } from "@/app/lib/organizations";
import { ORGANIZATION_TEXT as text } from "@/config/organizations";
export default function EmploymentFields({
  fixedMaquila,
}: {
  fixedMaquila?: number;
}) {
  const form = Form.useFormInstance();
  const maquilaId = Form.useWatch(["employment", "maquilaId"], form);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization>();
  const [search, setSearch] = useState("");
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      OrganizationService.list("maquila", search, 1, 100)
        .then((result) => {
          if (current) setOrganizations(result.data);
        })
        .catch(() => {
          if (current) setOrganizations([]);
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [search]);
  useEffect(() => {
    if (!maquilaId || fixedMaquila) {
      setSelectedOrganization(undefined);
      return;
    }
    let current = true;
    OrganizationService.list("maquila", "", 1, 1, undefined, maquilaId)
      .then((result) => {
        if (current) setSelectedOrganization(result.data[0]);
      })
      .catch(() => {
        if (current) setSelectedOrganization(undefined);
      });
    return () => {
      current = false;
    };
  }, [maquilaId, fixedMaquila]);
  const choices = [
    ...new Map(
      [
        ...organizations,
        ...(selectedOrganization ? [selectedOrganization] : []),
      ].map((record) => [record.id, record]),
    ).values(),
  ];
  const selected = Boolean(fixedMaquila || maquilaId);
  return (
    <fieldset className="mb-4 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold">{text.employment}</legend>
      {!fixedMaquila && (
        <Form.Item
          name={["employment", "maquilaId"]}
          label={text.maquila.singular}
        >
          <Select
            aria-label={text.maquila.singular}
            allowClear
            showSearch
            filterOption={false}
            onSearch={setSearch}
            placeholder={text.factoryPlaceholder}
            options={choices.map((record) => ({
              value: record.id,
              label: `${record.name} · #${record.id}`,
            }))}
            onClear={() =>
              form.setFieldValue("employment", {
                maquilaId: null,
                employeeNumber: "",
                shiftName: "",
                shiftStart: "",
                shiftEnd: "",
              })
            }
          />
        </Form.Item>
      )}
      {selected && (
        <>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item
              name={["employment", "employeeNumber"]}
              label={text.employeeNumber}
              rules={[{ required: true, message: text.required }]}
            >
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              name={["employment", "shiftName"]}
              label={text.shiftName}
              rules={[{ required: true, message: text.required }]}
            >
              <AutoComplete
                options={text.shiftNames.map((value) => ({ value }))}
                maxLength={100}
              />
            </Form.Item>
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item
              name={["employment", "shiftStart"]}
              label={text.shiftStart}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    (!value && !getFieldValue(["employment", "shiftEnd"])) ||
                    /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")
                      ? Promise.resolve()
                      : Promise.reject(new Error(text.required)),
                }),
              ]}
            >
              <Input type="time" />
            </Form.Item>
            <Form.Item
              name={["employment", "shiftEnd"]}
              label={text.shiftEnd}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    (!value && !getFieldValue(["employment", "shiftStart"])) ||
                    /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")
                      ? Promise.resolve()
                      : Promise.reject(new Error(text.required)),
                }),
              ]}
            >
              <Input type="time" />
            </Form.Item>
          </div>
          <p className="text-xs text-slate-500">{text.shiftHoursHint}</p>
        </>
      )}
    </fieldset>
  );
}
