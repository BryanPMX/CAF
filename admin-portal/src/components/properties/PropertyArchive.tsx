"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Drawer,
  Form,
  Empty,
  Input,
  InputNumber,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
  message,
  type FormInstance,
} from "antd";
import { useAuth } from "@/context/AuthContext";
import {
  canAccessAllOffices,
  canAccessOrganizationDirectory,
} from "@/config/roles";
import { apiClient } from "@/app/lib/api";
import { OrganizationService } from "@/services/organizationService";
import ClientSelect from "@/components/organizations/ClientSelect";
import {
  clientLabel,
  type ClientOption,
  type Organization,
} from "@/app/lib/organizations";
import {
  PropertyService,
  PROPERTY_KINDS,
  OWNERSHIP_STATES,
  dateOnly,
  formatRegistryDate,
  propertyError,
  type Property,
  type PropertyOwner,
  type RegistryEntry,
  type PropertyDocument,
} from "@/services/propertyService";

function DateField({ name, label }: { name: string; label: string }) {
  return (
    <Form.Item name={name} label={label}>
      <Input type="date" />
    </Form.Item>
  );
}
function TextField({
  name,
  label,
  max = 100,
}: {
  name: string;
  label: string;
  max?: number;
}) {
  return (
    <Form.Item name={name} label={label}>
      <Input maxLength={max} />
    </Form.Item>
  );
}
const kindLabel = (kind: string) =>
  PROPERTY_KINDS.find((item) => item.value === kind)?.label || kind;
const numberLabel = (value?: number | null) =>
  value == null
    ? "Sin dato"
    : Number(value).toLocaleString("es-MX", { maximumFractionDigits: 4 });

export default function PropertyArchive({
  organizationId,
  clientId,
  initialOfficeId,
  initialClient,
  initialOrganization,
  embedded = false,
}: {
  organizationId?: number;
  clientId?: number;
  initialOfficeId?: number;
  initialClient?: ClientOption;
  initialOrganization?: Organization;
  embedded?: boolean;
}) {
  const { user } = useAuth();
  const allowed = canAccessOrganizationDirectory(user?.role || "");
  const [records, setRecords] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Property | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("data");
  useEffect(() => setActiveTab("data"), [detailId]);
  const [editor, setEditor] = useState<{ record?: Property } | null>(null);
  const [ownerEditor, setOwnerEditor] = useState<{
    record?: PropertyOwner;
  } | null>(null);
  const [registryEditor, setRegistryEditor] = useState<{
    record?: RegistryEntry;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [discardAction, setDiscardAction] = useState<null | (() => void)>(null);
  const closeForm = (close: () => void) => {
    if (saving) return;
    if (!dirty) {
      close();
      return;
    }
    setDiscardAction(() => close);
  };
  const [uploading, setUploading] = useState(false);
  const [offices, setOffices] = useState<{ id: number; name: string }[]>([]);
  const [companies, setCompanies] = useState<Organization[]>([]);
  const [form] = Form.useForm();
  const [ownerForm] = Form.useForm();
  const [registryForm] = Form.useForm();
  const selectedOffice = Form.useWatch("officeId", form);
  const [parentSearch, setParentSearch] = useState("");
  const [parents, setParents] = useState<Property[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const reload = () => setRevision((value) => value + 1);
  const reportFormError = (form: FormInstance, error: unknown) => {
    if (error && typeof error === "object" && "errorFields" in error) {
      const fields = (error as { errorFields: { name: (string | number)[] }[] })
        .errorFields;
      if (fields[0]) form.scrollToField(fields[0].name, { block: "center" });
    } else setError(propertyError(error));
  };
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      PropertyService.list({ q: search, page, organizationId, clientId })
        .then((result) => {
          if (active) {
            setRecords(result.data);
            setTotal(result.total);
          }
        })
        .catch((e) => {
          if (active) setError(propertyError(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [allowed, search, page, organizationId, clientId, revision]);
  useEffect(() => {
    if (!allowed || !detailId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetail((previous) => (previous?.id === detailId ? previous : null));
    setLoadingDetail(true);
    PropertyService.get(detailId)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((e) => {
        if (active) setError(propertyError(e));
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, detailId, revision]);
  useEffect(() => {
    if (!editor) return;
    let active = true;
    apiClient
      .get<{ id: number; name: string }[]>("/offices")
      .then((response) => {
        if (active) setOffices(response.data);
      })
      .catch((e) => {
        if (active) setError(propertyError(e));
      });
    return () => {
      active = false;
    };
  }, [editor]);
  useEffect(() => {
    if (!editor) return;
    let active = true;
    const timer = setTimeout(() => {
      OrganizationService.list("constructora", companySearch, 1, 50)
        .then((result) => {
          if (active) setCompanies(result.data);
        })
        .catch((e) => {
          if (active) setError(propertyError(e));
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [editor, companySearch]);
  useEffect(() => {
    if (!editor) return;
    let active = true;
    const timer = setTimeout(() => {
      PropertyService.list({
        q: parentSearch,
        pageSize: 100,
        officeId: selectedOffice || undefined,
      })
        .then((result) => {
          if (active)
            setParents(
              result.data.filter(
                (item) => item.id !== editor.record?.id && item.kind !== "lot",
              ),
            );
        })
        .catch((e) => {
          if (active) setError(propertyError(e));
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [editor, parentSearch, selectedOffice]);
  const openEditor = (record?: Property) => {
    setDirty(false);
    setError(null);
    form.resetFields();
    form.setFieldsValue(
      record || {
        kind: "land",
        initialOwnerId: clientId,
        officeId:
          initialOfficeId ||
          (canAccessAllOffices(user?.role || "") ? undefined : user?.officeId),
        organizationId,
        state: "Chihuahua",
        district: "Bravos",
      },
    );
    setEditor({ record });
  };
  const save = async () => {
    try {
      const input = await form.validateFields();
      setSaving(true);
      const record = await PropertyService.save(
        {
          ...input,
          organizationId: input.organizationId || null,
          parentId: input.parentId || null,
          areaM2: input.areaM2 ?? null,
        },
        editor?.record?.id,
      );
      setDirty(false);
      setEditor(null);
      setDetailId(record.id);
      setDetail(record);
      reload();
      message.success("Propiedad guardada.");
    } catch (e) {
      reportFormError(form, e);
    } finally {
      setSaving(false);
    }
  };
  const openOwner = (record?: PropertyOwner) => {
    setDirty(false);
    setError(null);
    ownerForm.resetFields();
    ownerForm.setFieldsValue(
      record
        ? {
            ...record,
            startDate: dateOnly(record.startDate),
            endDate: dateOnly(record.endDate),
          }
        : { status: "reported", clientId },
    );
    setOwnerEditor({ record });
  };
  const saveOwner = async () => {
    if (!detail) return;
    try {
      const input = await ownerForm.validateFields();
      setSaving(true);
      setDetail(
        await PropertyService.owner(
          detail.id,
          {
            ...input,
            startDate: input.startDate || null,
            endDate: input.endDate || null,
            sharePercent: input.sharePercent ?? null,
          },
          ownerEditor?.record?.id,
        ),
      );
      setDirty(false);
      setOwnerEditor(null);
      reload();
      message.success("Propietario guardado.");
    } catch (e) {
      reportFormError(ownerForm, e);
    } finally {
      setSaving(false);
    }
  };
  const openRegistry = (record?: RegistryEntry) => {
    setDirty(false);
    setError(null);
    registryForm.resetFields();
    registryForm.setFieldsValue(
      record
        ? {
            ...record,
            instrumentDate: dateOnly(record.instrumentDate),
            registrationDate: dateOnly(record.registrationDate),
          }
        : {},
    );
    setRegistryEditor({ record });
  };
  const saveRegistry = async () => {
    if (!detail) return;
    try {
      const input = await registryForm.validateFields();
      setSaving(true);
      setDetail(
        await PropertyService.registry(
          detail.id,
          {
            ...input,
            instrumentDate: input.instrumentDate || null,
            registrationDate: input.registrationDate || null,
          },
          registryEditor?.record?.id,
        ),
      );
      setDirty(false);
      setRegistryEditor(null);
      reload();
      message.success("Datos registrales guardados.");
    } catch (e) {
      reportFormError(registryForm, e);
    } finally {
      setSaving(false);
    }
  };
  const download = async (file: PropertyDocument) => {
    if (!detail) return;
    setDownloading(file.id);
    try {
      await PropertyService.download(detail.id, file);
    } catch (e) {
      setError(propertyError(e));
    } finally {
      setDownloading(null);
    }
  };
  if (!allowed)
    return embedded ? null : (
      <Result status="403" title="Sin acceso al archivo de propiedades" />
    );
  const body = (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input.Search
          aria-label="Buscar propiedades"
          placeholder="Propiedad, persona, constructora o folio"
          maxLength={200}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ maxWidth: 520 }}
          allowClear
        />
        {embedded && (
          <Button type="primary" onClick={() => openEditor()}>
            Registrar propiedad
          </Button>
        )}
      </div>
      {error && !editor && !ownerEditor && !registryEditor && (
        <Alert
          type="error"
          showIcon
          message={error}
          className="mb-4"
          action={
            <Button size="small" onClick={reload}>
              Reintentar
            </Button>
          }
        />
      )}
      <Table
        rowKey="id"
        dataSource={records}
        loading={loading}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                search
                  ? "No se encontraron propiedades con esa búsqueda."
                  : "Todavía no hay propiedades registradas."
              }
            />
          ),
        }}
        scroll={{ x: canAccessAllOffices(user?.role || "") ? 860 : 700 }}
        pagination={{ current: page, pageSize: 20, total, onChange: setPage }}
        columns={[
          {
            title: "Propiedad",
            key: "name",
            render: (_, record: Property) => (
              <Button
                type="link"
                className="!h-auto !p-0 !text-left !whitespace-normal"
                onClick={() => setDetailId(record.id)}
              >
                {record.name}
              </Button>
            ),
          },
          ...(canAccessAllOffices(user?.role || "")
            ? [
                {
                  title: "Oficina responsable",
                  key: "office",
                  render: (_: unknown, record: Property) =>
                    record.office?.name || "—",
                },
              ]
            : []),
          { title: "Tipo", dataIndex: "kind", render: kindLabel },
          {
            title: "Fraccionamiento",
            dataIndex: "developmentName",
            render: (value: string) => value || "—",
          },
          {
            title: "Superficie (m²)",
            dataIndex: "areaM2",
            render: numberLabel,
          },
          {
            title: "Clave catastral",
            dataIndex: "cadastralKey",
            render: (value: string) => value || "—",
          },
        ]}
      />
    </>
  );
  return (
    <>
      {embedded ? (
        <div>{body}</div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mb-1 text-2xl font-semibold text-slate-900">
                Propiedades
              </h1>
              <p className="m-0 text-sm text-slate-500">
                Archivo de terrenos, manzanas y lotes con sus propietarios y
                datos del Registro Público.
              </p>
            </div>
            <Button type="primary" onClick={() => openEditor()}>
              Registrar propiedad
            </Button>
          </div>
          {body}
        </div>
      )}
      <Drawer
        title={detail?.name || "Propiedad"}
        width={880}
        open={detailId !== null}
        onClose={() => {
          setDetailId(null);
          setError(null);
        }}
        loading={loadingDetail && !detail}
        destroyOnClose
      >
        {error && (
          <Alert type="error" message={error} showIcon className="mb-4" />
        )}
        {detail && (
          <>
            <Space wrap className="mb-5">
              <Button onClick={() => openEditor(detail)}>
                Editar propiedad
              </Button>
              {detail.parentId && (
                <Button onClick={() => setDetailId(detail.parentId!)}>
                  Ver propiedad de origen
                </Button>
              )}
            </Space>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "data",
                  label: "Datos",
                  children: (
                    <Descriptions
                      column={{ xs: 1, sm: 2 }}
                      items={[
                        {
                          key: "office",
                          label: "Oficina responsable",
                          children: detail.office?.name || "—",
                        },
                        {
                          key: "company",
                          label: "Constructora relacionada",
                          children:
                            detail.organization?.name ||
                            "Sin constructora relacionada",
                        },
                        {
                          key: "kind",
                          label: "Tipo",
                          children: kindLabel(detail.kind),
                        },
                        {
                          key: "development",
                          label: "Fraccionamiento",
                          children: detail.developmentName || "—",
                        },
                        {
                          key: "area",
                          label: "Superficie",
                          children:
                            detail.areaM2 == null
                              ? "Sin dato"
                              : `${numberLabel(detail.areaM2)} m² (${numberLabel(detail.areaM2 / 10000)} ha)`,
                        },
                        ...(
                          [
                            ["address", "Ubicación"],
                            ["state", "Estado"],
                            ["municipality", "Municipio"],
                            ["district", "Distrito judicial"],
                            ["block", "Manzana"],
                            ["lot", "Lote"],
                            ["cadastralKey", "Clave catastral"],
                            ["notes", "Notas"],
                          ] as const
                        ).map(([key, label]) => ({
                          key,
                          label,
                          children: detail[key] || "—",
                        })),
                      ]}
                    />
                  ),
                },
                {
                  key: "owners",
                  label: "Propietarios",
                  children: (
                    <>
                      <p className="mb-3 text-sm text-slate-600">
                        Conserve los propietarios anteriores. Una inscripción
                        histórica no confirma por sí sola al propietario actual.
                      </p>
                      <Button className="mb-4" onClick={() => openOwner()}>
                        Agregar propietario
                      </Button>
                      <Table
                        rowKey="id"
                        dataSource={detail.owners || []}
                        pagination={false}
                        locale={{
                          emptyText: "Todavía no hay propietarios registrados.",
                        }}
                        scroll={{ x: 650 }}
                        columns={[
                          {
                            title: "Nombre",
                            key: "client",
                            render: (_, owner: PropertyOwner) =>
                              owner.client
                                ? clientLabel(owner.client)
                                : "Persona fuera de su alcance",
                          },
                          {
                            title: "Porcentaje",
                            dataIndex: "sharePercent",
                            render: (value: number | null) =>
                              value == null
                                ? "Sin dato"
                                : `${numberLabel(value)}%`,
                          },
                          {
                            title: "Estado",
                            dataIndex: "status",
                            render: (value: string) => (
                              <Tag>
                                {
                                  OWNERSHIP_STATES.find(
                                    (item) => item.value === value,
                                  )?.label
                                }
                              </Tag>
                            ),
                          },
                          {
                            title: "Desde",
                            dataIndex: "startDate",
                            render: formatRegistryDate,
                          },
                          {
                            title: "Hasta",
                            dataIndex: "endDate",
                            render: formatRegistryDate,
                          },
                          { title: "Fuente", dataIndex: "source" },
                          {
                            title: "Acciones",
                            key: "actions",
                            render: (_, owner: PropertyOwner) => (
                              <Button
                                size="small"
                                onClick={() => openOwner(owner)}
                                disabled={!owner.client}
                              >
                                Editar
                              </Button>
                            ),
                          },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: "registry",
                  label: "Registro Público",
                  children: (
                    <>
                      <Button className="mb-4" onClick={() => openRegistry()}>
                        Agregar inscripción
                      </Button>
                      <Table
                        rowKey="id"
                        dataSource={detail.registryEntries || []}
                        pagination={false}
                        locale={{
                          emptyText:
                            "Todavía no hay inscripciones registradas.",
                        }}
                        scroll={{ x: 780 }}
                        expandable={{
                          expandedRowRender: (entry: RegistryEntry) => (
                            <Descriptions
                              column={1}
                              items={[
                                {
                                  key: "act",
                                  label: "Acto",
                                  children: entry.actType || "—",
                                },
                                {
                                  key: "instrument",
                                  label: "Escritura / instrumento",
                                  children: entry.instrumentNumber || "—",
                                },
                                {
                                  key: "instrumentDate",
                                  label: "Fecha del instrumento",
                                  children: formatRegistryDate(
                                    entry.instrumentDate,
                                  ),
                                },
                                {
                                  key: "date",
                                  label: "Fecha de inscripción",
                                  children: formatRegistryDate(
                                    entry.registrationDate,
                                  ),
                                },
                                {
                                  key: "notary",
                                  label: "Notaría",
                                  children: entry.notary || "—",
                                },
                                {
                                  key: "source",
                                  label: "Fuente",
                                  children: entry.source || "—",
                                },
                              ]}
                            />
                          ),
                        }}
                        columns={[
                          ...(
                            [
                              ["realFolio", "Folio Real"],
                              ["inscription", "Inscripción"],
                              ["folio", "Folio"],
                              ["book", "Libro"],
                              ["section", "Sección"],
                            ] as const
                          ).map(([dataIndex, title]) => ({
                            title,
                            dataIndex,
                            render: (value: string) => value || "—",
                          })),
                          {
                            title: "Acciones",
                            key: "actions",
                            render: (_, entry: RegistryEntry) => (
                              <Button
                                size="small"
                                onClick={() => openRegistry(entry)}
                              >
                                Editar
                              </Button>
                            ),
                          },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: "documents",
                  label: "Documentos",
                  children: (
                    <>
                      <Upload
                        disabled={uploading}
                        showUploadList={false}
                        beforeUpload={(file) => {
                          setUploading(true);
                          PropertyService.upload(detail.id, file)
                            .then(() => {
                              reload();
                              message.success("Documento guardado.");
                            })
                            .catch((e) => setError(propertyError(e)))
                            .finally(() => setUploading(false));
                          return false;
                        }}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      >
                        <Button loading={uploading}>Adjuntar documento</Button>
                      </Upload>
                      <p className="my-3 text-sm text-slate-600">
                        Escrituras, consultas, fotografías o documentos de
                        respaldo. Se conservan en el archivo de esta propiedad.
                        Máximo 25 MB por archivo.
                      </p>
                      <Table
                        rowKey="id"
                        dataSource={detail.documents || []}
                        pagination={false}
                        locale={{
                          emptyText: "Todavía no hay documentos adjuntos.",
                        }}
                        columns={[
                          { title: "Documento", dataIndex: "fileName" },
                          {
                            title: "Acciones",
                            key: "actions",
                            render: (_, file: PropertyDocument) => (
                              <Button
                                loading={downloading === file.id}
                                disabled={
                                  downloading !== null &&
                                  downloading !== file.id
                                }
                                onClick={() => void download(file)}
                              >
                                Descargar
                              </Button>
                            ),
                          },
                        ]}
                      />
                    </>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <Modal
        title={editor?.record ? "Editar propiedad" : "Registrar propiedad"}
        open={editor !== null}
        onCancel={() => closeForm(() => setEditor(null))}
        onOk={() => void save()}
        confirmLoading={saving}
        styles={{ body: { maxHeight: "65vh", overflowY: "auto" } }}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        keyboard={!saving}
        maskClosable={false}
        okText="Guardar"
        cancelText="Cancelar"
        width={720}
        destroyOnClose
      >
        {error && (
          <Alert type="error" showIcon message={error} className="mb-4" />
        )}
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => setDirty(true)}
        >
          <Form.Item
            name="name"
            label="Nombre para identificar la propiedad"
            rules={[{ required: true, message: "Indique un nombre." }]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="kind"
                label="Tipo"
                rules={[
                  {
                    required: true,
                    message: "Seleccione un tipo de propiedad.",
                  },
                ]}
              >
                <Select options={PROPERTY_KINDS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="officeId"
                label="Oficina responsable"
                rules={[{ required: true, message: "Seleccione una oficina." }]}
              >
                <Select
                  disabled={
                    !canAccessAllOffices(user?.role || "") || !!editor?.record
                  }
                  options={offices.map((office) => ({
                    value: office.id,
                    label: office.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="organizationId"
            label="Constructora relacionada (opcional)"
          >
            <Select
              showSearch
              allowClear
              filterOption={false}
              onSearch={setCompanySearch}
              options={[
                ...new Map(
                  [
                    ...(editor?.record?.organizationId &&
                    !companies.some(
                      (company) => company.id === editor.record?.organizationId,
                    )
                      ? [
                          {
                            id: editor.record.organizationId,
                            name:
                              editor.record.organization?.name ||
                              `Constructora #${editor.record.organizationId}`,
                          },
                        ]
                      : []),
                    ...(initialOrganization ? [initialOrganization] : []),
                    ...companies,
                  ].map((company) => [company.id, company]),
                ).values(),
              ].map((company) => ({ value: company.id, label: company.name }))}
            />
          </Form.Item>
          {!editor?.record && (
            <Form.Item
              name="initialOwnerId"
              label="Propietario inicial (opcional)"
              extra="La titularidad se guardará como por confirmar."
            >
              <ClientSelect
                officeId={selectedOffice}
                initialClients={initialClient ? [initialClient] : []}
              />
            </Form.Item>
          )}
          <TextField
            name="developmentName"
            label="Fraccionamiento (opcional)"
            max={255}
          />
          <Form.Item
            name="parentId"
            label="Terreno o manzana de origen (opcional)"
          >
            <Select
              allowClear
              showSearch
              filterOption={false}
              onSearch={setParentSearch}
              options={[
                ...new Map(
                  [
                    ...(editor?.record?.parentId &&
                    !parents.some(
                      (parent) => parent.id === editor.record?.parentId,
                    )
                      ? [
                          {
                            id: editor.record.parentId,
                            name: `Propiedad #${editor.record.parentId}`,
                          },
                        ]
                      : []),
                    ...parents,
                  ].map((parent) => [parent.id, parent]),
                ).values(),
              ].map((parent) => ({ value: parent.id, label: parent.name }))}
            />
          </Form.Item>
          <Form.Item name="address" label="Ubicación">
            <Input.TextArea maxLength={1000} rows={2} />
          </Form.Item>
          <Row gutter={16}>
            {(
              [
                ["state", "Estado"],
                ["municipality", "Municipio"],
                ["district", "Distrito judicial"],
                ["block", "Manzana"],
                ["lot", "Lote"],
                ["cadastralKey", "Clave catastral"],
              ] as const
            ).map(([name, label]) => (
              <Col xs={24} sm={12} key={name}>
                <TextField name={name} label={label} />
              </Col>
            ))}
          </Row>
          <Form.Item
            name="areaM2"
            label="Superficie en metros cuadrados"
            extra="Una hectárea equivale a 10,000 m²."
          >
            <InputNumber
              min={0.0001}
              max={99999999999999}
              precision={4}
              className="w-full"
            />
          </Form.Item>
          <Form.Item name="notes" label="Notas">
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={
          ownerEditor?.record ? "Editar propietario" : "Agregar propietario"
        }
        open={ownerEditor !== null}
        onCancel={() => closeForm(() => setOwnerEditor(null))}
        onOk={() => void saveOwner()}
        confirmLoading={saving}
        styles={{ body: { maxHeight: "65vh", overflowY: "auto" } }}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        keyboard={!saving}
        maskClosable={false}
        okText="Guardar"
        cancelText="Cancelar"
        destroyOnClose
      >
        {error && (
          <Alert type="error" message={error} showIcon className="mb-4" />
        )}
        <Form
          form={ownerForm}
          layout="vertical"
          onValuesChange={() => setDirty(true)}
        >
          <Form.Item
            name="clientId"
            label="Persona o empresa propietaria"
            rules={[{ required: true, message: "Seleccione un cliente." }]}
          >
            {ownerEditor?.record ? (
              <Select
                disabled
                options={[
                  {
                    value: ownerEditor.record.clientId,
                    label: ownerEditor.record.client
                      ? clientLabel(ownerEditor.record.client)
                      : "Cliente registrado",
                  },
                ]}
              />
            ) : (
              <ClientSelect
                officeId={detail?.officeId}
                initialClients={initialClient ? [initialClient] : []}
              />
            )}
          </Form.Item>
          <Form.Item
            name="status"
            label="Estado"
            rules={[
              {
                required: true,
                message: "Seleccione el estado de la titularidad.",
              },
            ]}
          >
            <Select options={OWNERSHIP_STATES} />
          </Form.Item>
          <Form.Item name="sharePercent" label="Porcentaje (opcional)">
            <InputNumber min={0.0001} max={100} precision={4} addonAfter="%" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <DateField
                name="startDate"
                label="Fecha de inicio (si se conoce)"
              />
            </Col>
            <Col xs={24} sm={12}>
              <DateField
                name="endDate"
                label="Fecha de término (si se conoce)"
              />
            </Col>
          </Row>
          <Form.Item name="source" label="Fuente o aclaración">
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={
          registryEditor?.record ? "Editar inscripción" : "Agregar inscripción"
        }
        open={registryEditor !== null}
        onCancel={() => closeForm(() => setRegistryEditor(null))}
        onOk={() => void saveRegistry()}
        confirmLoading={saving}
        styles={{ body: { maxHeight: "65vh", overflowY: "auto" } }}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        keyboard={!saving}
        maskClosable={false}
        okText="Guardar"
        cancelText="Cancelar"
        width={680}
        destroyOnClose
      >
        {error && (
          <Alert type="error" message={error} showIcon className="mb-4" />
        )}
        <Form
          form={registryForm}
          layout="vertical"
          onValuesChange={() => setDirty(true)}
        >
          <p className="mb-4 text-sm text-slate-600">
            Capture los datos disponibles. Folio Real y Folio son campos
            distintos. Los ceros iniciales se conservan.
          </p>
          <Row gutter={16}>
            {(
              [
                ["realFolio", "Folio Real"],
                ["inscription", "Inscripción"],
                ["folio", "Folio"],
                ["book", "Libro"],
                ["section", "Sección"],
                ["instrumentNumber", "Escritura / instrumento"],
              ] as const
            ).map(([name, label]) => (
              <Col xs={24} sm={12} key={name}>
                <TextField name={name} label={label} />
              </Col>
            ))}
          </Row>
          <TextField name="actType" label="Tipo de acto" max={255} />
          <TextField name="notary" label="Notaría / notario" max={255} />
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <DateField name="instrumentDate" label="Fecha del instrumento" />
            </Col>
            <Col xs={24} sm={12}>
              <DateField name="registrationDate" label="Fecha de inscripción" />
            </Col>
          </Row>
          <Form.Item name="source" label="Fuente o aclaración">
            <Input.TextArea maxLength={2000} rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="¿Descartar los cambios?"
        open={discardAction !== null}
        onCancel={() => setDiscardAction(null)}
        onOk={() => {
          setDirty(false);
          discardAction?.();
          setDiscardAction(null);
        }}
        okText="Descartar cambios"
        cancelText="Seguir editando"
        okButtonProps={{ danger: true }}
        cancelButtonProps={{ autoFocus: true }}
        maskClosable={false}
        destroyOnClose
      >
        <p>Los cambios de este formulario todavía no se han guardado.</p>
      </Modal>
    </>
  );
}
