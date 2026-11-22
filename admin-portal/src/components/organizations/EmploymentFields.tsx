"use client";
import { useEffect, useState } from "react";
import { AutoComplete, Col, Form, Input, Row, Select } from "antd";
import FormSection from "@/components/forms/FormSection";
import { OrganizationService } from "@/services/organizationService";
import type { Organization } from "@/app/lib/organizations";
import { ORGANIZATION_TEXT as text } from "@/config/organizations";
export default function EmploymentFields({
  fixedMaquila,
  description = text.employmentHint,
  disabled = false,
}: {
  fixedMaquila?: number;
  description?: string;
  disabled?: boolean;
}) {
  const form = Form.useFormInstance();
  const maquilaId = Form.useWatch(["employment", "maquilaId"], form);
  const [organizations, setOrganizations] = useState<Pick<Organization, "id" | "name">[]>([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState<Pick<Organization, "id" | "name">>();
  const [search, setSearch] = useState("");
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      OrganizationService.factories(search)
        .then((result) => {
          if (current) setOrganizations(result);
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
    OrganizationService.factories("", maquilaId)
      .then((result) => {
        if (current) setSelectedOrganization(result[0]);
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
    <FormSection title={text.employment} description={description} optional={!fixedMaquila}>
      {!fixedMaquila && (
        <Form.Item
          name={["employment", "maquilaId"]}
          label={text.maquila.singular}
        >
          <Select
            disabled={disabled}
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
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name={["employment", "employeeNumber"]}
                label={text.employeeNumber}
                rules={[{ required: true, message: text.required }]}
              >
                <Input maxLength={100} disabled={disabled} placeholder="Ej. 000042" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name={["employment", "shiftName"]}
                label={text.shiftName}
                rules={[{ required: true, message: text.required }]}
              >
                <AutoComplete
                  options={text.shiftNames.map((value) => ({ value }))}
                  maxLength={100}
                  disabled={disabled}
                  placeholder="Seleccione o escriba el turno"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name={["employment", "shiftStart"]}
                label={text.shiftStart}
                dependencies={[["employment", "shiftEnd"]]}
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
                <Input type="time" disabled={disabled} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name={["employment", "shiftEnd"]}
                label={text.shiftEnd}
                dependencies={[["employment", "shiftStart"]]}
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
                <Input type="time" disabled={disabled} />
              </Form.Item>
            </Col>
          </Row>
          <p className="text-xs text-slate-500">{text.shiftHoursHint}</p>
        </>
      )}
    </FormSection>
  );
}
