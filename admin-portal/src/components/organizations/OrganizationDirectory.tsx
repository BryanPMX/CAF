"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tabs,
  Tag,
} from "antd";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { isManagementRole, canAccessAllOffices } from "@/config/roles";
import {
  ORGANIZATION_TEXT as text,
  type OrganizationKind,
} from "@/config/organizations";
import {
  OrganizationService,
  type OrganizationClientRow,
  type OrganizationDetail,
} from "@/services/organizationService";
import {
  WorkflowService,
  type WorkflowOffice,
} from "@/services/workflowService";
import { getCaseStatusDisplayName } from "@/config/statuses";
import { CalendarService } from "@/services/calendarService";
import type { CalendarStaffMember } from "@/app/lib/calendar";
import {
  clientLabel,
  type ClientOption,
  type EmploymentInput,
  type Organization,
} from "@/app/lib/organizations";
import CreateCaseModal from "@/app/(dashboard)/app/cases/components/CreateCaseModal";
import CalendarEventModal from "@/app/(dashboard)/app/calendar/components/CalendarEventModal";
import ClientSelect from "./ClientSelect";
import EmploymentFields from "./EmploymentFields";
import DirectClientAppointmentModal from "./DirectClientAppointmentModal";

function failureMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || text.failed
  );
}

export default function OrganizationDirectory({
  kind,
}: {
  kind: OrganizationKind;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [records, setRecords] = useState<Organization[]>([]);
  const [offices, setOffices] = useState<WorkflowOffice[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ record?: Organization } | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [casePage, setCasePage] = useState(1);
  const [activeTab, setActiveTab] = useState("data");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [caseClient, setCaseClient] = useState<{
    client: ClientOption;
    employment: EmploymentInput;
  } | null>(null);
  const [appointmentClient, setAppointmentClient] =
    useState<ClientOption | null>(null);
  const [eventClients, setEventClients] = useState<ClientOption[] | null>(null);
  const [calendarStaff, setCalendarStaff] = useState<CalendarStaffMember[]>([]);
  const [eventDate] = useState(() => dayjs());
  const canEdit = Boolean(user && isManagementRole(user.role));

  useEffect(() => {
    if (!user || user.role === "client") return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      OrganizationService.list(kind, q, page)
        .then((result) => {
          if (active) {
            setRecords(result.data);
            setTotal(result.total);
          }
        })
        .catch((error) => {
          if (active) setError(failureMessage(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [kind, q, page, revision, user]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetail((previous) =>
      previous?.organization.id === selectedId ? previous : null,
    );
    setDetailLoading(true);
    OrganizationService.detail(selectedId, clientPage, casePage)
      .then((result) => {
        if (active && result.organization.kind === kind) setDetail(result);
      })
      .catch((error) => {
        if (active) setError(failureMessage(error));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, revision, kind, clientPage, casePage]);

  useEffect(() => {
    const id = Number(
      new URLSearchParams(window.location.search).get("organizationId"),
    );
    if (Number.isInteger(id) && id > 0) setSelectedId(id);
  }, []);
  useEffect(() => {
    if (!user || !canEdit) return;
    let active = true;
    WorkflowService.listOffices(user.role)
      .then((rows) => {
        if (active) setOffices(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, canEdit]);
  useEffect(() => {
    if (eventClients === null) return;
    let active = true;
    CalendarService.listStaff()
      .then((rows) => {
        if (active) setCalendarStaff(rows);
      })
      .catch((error) => setError(failureMessage(error)));
    return () => {
      active = false;
    };
  }, [eventClients]);

  const refresh = () => setRevision((value) => value + 1);
  const openEditor = (record?: Organization) => {
    form.resetFields();
    setError(null);
    const account =
      detail?.organization.id === record?.id
        ? detail?.accountClient
        : undefined;
    form.setFieldsValue({
      ...record,
      officeId:
        kind === "constructora"
          ? record?.officeId || user?.officeId
          : undefined,
      email: account?.email || "",
      phone: account?.phone || "",
    });
    setEditor({ record });
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await OrganizationService.save(
        {
          ...values,
          kind,
          officeId: kind === "constructora" ? values.officeId : undefined,
        },
        editor?.record?.id,
      );
      setEditor(null);
      refresh();
    } catch (error) {
      if (!(error && typeof error === "object" && "errorFields" in error))
        setError(failureMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const link = async () => {
    if (!detail) return;
    try {
      const values = await linkForm.validateFields();
      setSaving(true);
      await OrganizationService.link(
        detail.organization.id,
        values.clientId,
        values.employment,
      );
      setLinking(false);
      refresh();
    } catch (error) {
      if (!(error && typeof error === "object" && "errorFields" in error))
        setError(failureMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const companyAccount = detail?.accountClient;
  const clientActions = (row: OrganizationClientRow) => (
    <div className="flex flex-wrap gap-1">
      {canEdit && (
        <Button
          size="small"
          onClick={() => router.push(`/app/users/${row.client.id}`)}
        >
          {text.profile}
        </Button>
      )}
      <Button
        size="small"
        onClick={() =>
          router.push(`/app/appointments?clientId=${row.client.id}`)
        }
      >
        {text.viewAppointments}
      </Button>
      <Button size="small" onClick={() => setEventClients([row.client])}>
        {text.createEvent}
      </Button>
      {kind === "maquila" && row.client.clientType !== "organization" && (
        <Button
          size="small"
          onClick={() =>
            setCaseClient({
              client: row.client,
              employment: {
                maquilaId: detail?.organization.id,
                employeeNumber: row.membership?.employeeNumber || "",
                shiftName: row.membership?.shiftName || "",
                shiftStart: row.membership?.shiftStart,
                shiftEnd: row.membership?.shiftEnd,
              },
            })
          }
        >
          {text.createCase}
        </Button>
      )}
      {canEdit &&
        row.membership &&
        row.client.id !== detail?.organization.accountClientId && (
          <Popconfirm
            title={text.unlinkConfirm}
            onConfirm={async () => {
              try {
                await OrganizationService.unlink(
                  detail!.organization.id,
                  row.client.id,
                );
                refresh();
              } catch (error) {
                setError(failureMessage(error));
              }
            }}
          >
            <Button
              size="small"
              danger
              aria-label={`${text.unlink} ${clientLabel(row.client)}`}
            >
              {text.unlink}
            </Button>
          </Popconfirm>
        )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-slate-900">
            {text[kind].title}
          </h1>
          <p className="m-0 text-sm text-slate-500">{text[kind].description}</p>
        </div>
        {canEdit && (
          <Button type="primary" onClick={() => openEditor()}>
            {text[kind].add}
          </Button>
        )}
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          message={error}
          action={<Button onClick={refresh}>{text.retry}</Button>}
        />
      )}
      <Input.Search
        aria-label={text.search}
        placeholder={text.search}
        allowClear
        value={q}
        onChange={(event) => {
          setPage(1);
          setQ(event.target.value);
        }}
        className="max-w-md"
      />
      <Table
        rowKey="id"
        dataSource={records}
        loading={loading}
        scroll={{ x: 600 }}
        pagination={{ current: page, pageSize: 20, total, onChange: setPage }}
        columns={[
          {
            title: text.name,
            key: "name",
            render: (_, record: Organization) => (
              <>
                <Button
                  type="link"
                  className="!p-0"
                  onClick={() => {
                    setClientPage(1);
                    setCasePage(1);
                    setActiveTab("data");
                    setSelectedId(record.id);
                  }}
                >
                  {record.name}
                </Button>
                {kind === "maquila" && (
                  <span className="ml-3 text-xs text-slate-400">
                    #{record.id}
                  </span>
                )}
              </>
            ),
          },
          ...(kind === "constructora"
            ? [
                {
                  title: text.office,
                  dataIndex: ["office", "name"],
                  key: "office",
                },
              ]
            : []),
        ]}
        locale={{ emptyText: text.empty }}
      />
      <Drawer
        title={detail?.organization.name || text[kind].singular}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        width={960}
        loading={detailLoading && !detail}
      >
        {error && (
          <Alert type="error" showIcon message={error} className="mb-4" />
        )}
        {detail && (
          <>
            <div className="mb-5 flex flex-wrap gap-2">
              {canEdit && (
                <Button onClick={() => openEditor(detail.organization)}>
                  {text.edit}
                </Button>
              )}
              {canEdit && (
                <Button
                  onClick={() => {
                    setError(null);
                    linkForm.resetFields();
                    setLinking(true);
                  }}
                >
                  {text.linkClient}
                </Button>
              )}
              {companyAccount && (
                <Button
                  type="primary"
                  onClick={() => setAppointmentClient(companyAccount)}
                >
                  {text.createAppointment}
                </Button>
              )}
            </div>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "data",
                  label: text.details,
                  children: (
                    <Descriptions
                      column={{ xs: 1, sm: 2 }}
                      items={[
                        {
                          key: "office",
                          label:
                            kind === "constructora" ? text.office : text.scope,
                          children:
                            kind === "constructora"
                              ? detail.organization.office?.name
                              : text.sharedFactoryHint,
                        },
                        ...(kind === "constructora"
                          ? [
                              {
                                key: "representative",
                                label: text.legalRepresentative,
                                children:
                                  detail.organization.legalRepresentative,
                              },
                              {
                                key: "address",
                                label: text.legalAddress,
                                children: detail.organization.legalAddress,
                              },
                              {
                                key: "president",
                                label: text.boardPresident,
                                children: detail.organization.boardPresident,
                              },
                              {
                                key: "neighborhood",
                                label: text.neighborhood,
                                children: detail.organization.neighborhood,
                              },
                            ]
                          : []),
                      ]}
                    />
                  ),
                },
                {
                  key: "clients",
                  label: text.clients,
                  children: (
                    <Table
                      rowKey={(row) => row.client.id}
                      dataSource={detail.clients}
                      scroll={{ x: 750 }}
                      loading={detailLoading}
                      pagination={{
                        pageSize: 20,
                        current: clientPage,
                        total: detail.clientTotal,
                        onChange: setClientPage,
                      }}
                      columns={[
                        {
                          key: "name",
                          title: text.name,
                          render: (_, row: OrganizationClientRow) => (
                            <>
                              {clientLabel(row.client)}
                              {row.client.id ===
                                detail.organization.accountClientId && (
                                <Tag className="ml-2">{text.account}</Tag>
                              )}
                              {row.historical && <Tag>{text.historical}</Tag>}
                            </>
                          ),
                        },
                        ...(kind === "maquila" &&
                        canAccessAllOffices(user?.role || "")
                          ? [
                              {
                                key: "office",
                                title: text.office,
                                dataIndex: ["client", "office", "name"],
                              },
                            ]
                          : []),
                        ...(kind === "maquila"
                          ? [
                              {
                                key: "employee",
                                title: text.employeeNumber,
                                render: (
                                  _: unknown,
                                  row: OrganizationClientRow,
                                ) => row.membership?.employeeNumber || "—",
                              },
                              {
                                key: "shift",
                                title: text.shiftName,
                                render: (
                                  _: unknown,
                                  row: OrganizationClientRow,
                                ) =>
                                  row.membership
                                    ? `${row.membership.shiftName} ${row.membership.shiftStart || ""}${row.membership.shiftEnd ? "–" + row.membership.shiftEnd : ""}`
                                    : "—",
                              },
                            ]
                          : []),
                        {
                          key: "actions",
                          title: text.actions,
                          render: (_: unknown, row: OrganizationClientRow) =>
                            clientActions(row),
                        },
                      ]}
                    />
                  ),
                },
                ...(kind === "maquila"
                  ? [
                      {
                        key: "cases",
                        label: text.cases,
                        children: (
                          <Table
                            rowKey="id"
                            dataSource={detail.cases}
                            loading={detailLoading}
                            pagination={{
                              pageSize: 20,
                              current: casePage,
                              total: detail.caseTotal,
                              onChange: setCasePage,
                            }}
                            scroll={{ x: 650 }}
                            columns={[
                              {
                                key: "title",
                                title: text.case,
                                render: (
                                  _: unknown,
                                  record: OrganizationDetail["cases"][number],
                                ) => (
                                  <Button
                                    type="link"
                                    onClick={() =>
                                      router.push(`/app/cases/${record.id}`)
                                    }
                                  >
                                    {record.title}
                                  </Button>
                                ),
                              },
                              {
                                key: "client",
                                title: text.selectClient,
                                render: (
                                  _: unknown,
                                  record: OrganizationDetail["cases"][number],
                                ) =>
                                  record.client
                                    ? clientLabel(record.client)
                                    : "—",
                              },
                              ...(canAccessAllOffices(user?.role || "")
                                ? [
                                    {
                                      key: "office",
                                      title: text.office,
                                      dataIndex: ["office", "name"],
                                    },
                                  ]
                                : []),
                              {
                                key: "employee",
                                title: text.employeeNumber,
                                dataIndex: "employeeNumber",
                              },
                              {
                                key: "shift",
                                title: text.shiftName,
                                dataIndex: "shiftName",
                              },
                              {
                                key: "status",
                                title: text.status,
                                dataIndex: "status",
                                render: (status: string) =>
                                  getCaseStatusDisplayName(status),
                              },
                            ]}
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        )}
      </Drawer>
      <Modal
        title={editor?.record ? text.edit : text[kind].add}
        open={editor !== null}
        onCancel={() => setEditor(null)}
        onOk={save}
        confirmLoading={saving}
        okText={text.save}
        cancelText={text.cancel}
        destroyOnClose
      >
        {error && (
          <Alert type="error" showIcon message={error} className="mb-4" />
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={text.name}
            rules={[{ required: true, message: text.required }]}
          >
            <Input maxLength={255} />
          </Form.Item>
          {kind === "constructora" && (
            <>
              <Form.Item
                name="officeId"
                label={text.office}
                rules={[{ required: true, message: text.required }]}
              >
                <Select
                  disabled={
                    Boolean(editor?.record) ||
                    !canAccessAllOffices(user?.role || "")
                  }
                  options={offices.map((office) => ({
                    value: office.id,
                    label: office.name,
                  }))}
                />
              </Form.Item>
            </>
          )}
          {kind === "constructora" && (
            <>
              <Form.Item
                name="legalRepresentative"
                label={text.legalRepresentative}
                rules={[{ required: true, message: text.required }]}
              >
                <Input maxLength={255} />
              </Form.Item>
              <Form.Item
                name="legalAddress"
                label={text.legalAddress}
                rules={[{ required: true, message: text.required }]}
              >
                <Input.TextArea rows={2} maxLength={1000} />
              </Form.Item>
              <Form.Item
                name="boardPresident"
                label={text.boardPresident}
                rules={[{ required: true, message: text.required }]}
              >
                <Input maxLength={255} />
              </Form.Item>
              <Form.Item
                name="neighborhood"
                label={text.neighborhood}
                rules={[{ required: true, message: text.required }]}
              >
                <Input maxLength={255} />
              </Form.Item>
              <Form.Item
                name="email"
                label={text.email}
                rules={[{ type: "email" }]}
              >
                <Input maxLength={255} />
              </Form.Item>
              <Form.Item name="phone" label={text.phone}>
                <Input maxLength={50} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
      <Modal
        title={text.linkClient}
        open={linking}
        onCancel={() => setLinking(false)}
        onOk={link}
        okText={text.save}
        cancelText={text.cancel}
        confirmLoading={saving}
        destroyOnClose
      >
        {error && (
          <Alert type="error" showIcon message={error} className="mb-4" />
        )}
        {kind === "maquila" && (
          <p className="mb-4 text-sm text-slate-500">
            {text.assignedClientHint}
          </p>
        )}
        <Form form={linkForm} layout="vertical">
          <Form.Item
            name="clientId"
            label={text.selectClient}
            rules={[{ required: true, message: text.required }]}
          >
            <ClientSelect
              officeId={detail?.organization.officeId || undefined}
              clientType="person"
            />
          </Form.Item>
          {kind === "maquila" && detail && (
            <EmploymentFields
              fixedMaquila={detail.organization.id}
            />
          )}
        </Form>
      </Modal>
      <CreateCaseModal
        visible={caseClient !== null}
        initialClient={caseClient?.client}
        initialEmployment={caseClient?.employment}
        onClose={() => setCaseClient(null)}
        onSuccess={refresh}
      />
      <DirectClientAppointmentModal
        open={appointmentClient !== null}
        initialClient={appointmentClient || undefined}
        onClose={() => setAppointmentClient(null)}
        onSaved={refresh}
      />
      {user && (
        <CalendarEventModal
          open={eventClients !== null}
          event={null}
          initialClients={eventClients || undefined}
          staff={calendarStaff}
          currentUserId={user.id}
          initialDate={eventDate}
          onCancel={() => setEventClients(null)}
          onSaved={() => {
            setEventClients(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
