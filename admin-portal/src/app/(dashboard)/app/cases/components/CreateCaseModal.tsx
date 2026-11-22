'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Spin,
  message,
} from 'antd';
import { isAxiosError } from 'axios';
import FormSection from '@/components/forms/FormSection';
import EmploymentFields from '@/components/organizations/EmploymentFields';
import { ORGANIZATION_TEXT } from '@/config/organizations';
import { canAccessAllOffices } from '@/config/roles';
import {
  clientLabel,
  employmentFromMemberships,
  type ClientOption,
  type EmploymentInput,
} from '@/app/lib/organizations';
import { CASE_TYPES, findDepartmentByCaseType } from '@/app/lib/caseTaxonomy';
import { useAuth } from '@/context/AuthContext';
import { OrganizationService } from '@/services/organizationService';
import {
  WorkflowService,
  type WorkflowOffice,
} from '@/services/workflowService';
import styles from './CreateCaseModal.module.css';

interface CreateCaseModalProps {
  initialClient?: ClientOption;
  initialEmployment?: EmploymentInput;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CaseFormValues {
  clientId?: number;
  clientSearch?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  officeId: number;
  title: string;
  description: string;
  fee?: number | null;
  docketNumber?: string;
  court?: string;
  employment?: EmploymentInput;
}

type ClientChoice = { value: string; label: string; key: number };

export default function CreateCaseModal({
  visible,
  onClose,
  onSuccess,
  initialClient,
  initialEmployment,
}: CreateCaseModalProps) {
  const [form] = Form.useForm<CaseFormValues>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [officeError, setOfficeError] = useState(false);
  const [officeRevision, setOfficeRevision] = useState(0);
  const [employmentError, setEmploymentError] = useState(false);
  const [employmentRevision, setEmploymentRevision] = useState(0);
  const [employmentLoading, setEmploymentLoading] = useState(false);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [offices, setOffices] = useState<WorkflowOffice[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientChoice[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientSearchError, setClientSearchError] = useState(false);
  const selectedClientId = Form.useWatch('clientId', form);
  const searchRevision = useRef(0);
  const selectedTitle = Form.useWatch('title', form);
  const category = findDepartmentByCaseType(selectedTitle) || 'General';

  useEffect(() => {
    if (!visible) return;
    searchRevision.current += 1;
    setClientMode('existing');
    setClientOptions([]);
    setClientSearchLoading(false);
    setClientSearchError(false);
    setSubmitError(undefined);
    form.resetFields();
    form.setFieldsValue({
      clientSearch: initialClient ? clientLabel(initialClient) : '',
      clientId: initialClient?.id,
      officeId: canAccessAllOffices(user?.role ?? '')
        ? (initialClient?.officeId ?? undefined)
        : user?.officeId,
      employment: initialEmployment,
    });
    return () => {
      searchRevision.current += 1;
    };
  }, [visible, form, user, initialClient, initialEmployment]);

  useEffect(() => {
    if (!visible || !user) return;
    let active = true;
    setOfficeError(false);
    setOffices([]);
    WorkflowService.listOffices(user.role)
      .then((rows) => {
        if (active)
          setOffices(
            canAccessAllOffices(user.role)
              ? rows
              : rows.filter((office) => office.id === user.officeId)
          );
      })
      .catch(() => {
        if (active) setOfficeError(true);
      });
    return () => {
      active = false;
    };
  }, [visible, user, officeRevision]);

  useEffect(() => {
    setEmploymentError(false);
    if (
      !visible ||
      !selectedClientId ||
      (initialEmployment && selectedClientId === initialClient?.id)
    ) {
      setEmploymentLoading(false);
      return;
    }
    let active = true;
    setEmploymentLoading(true);
    form.setFieldValue('employment', undefined);
    OrganizationService.memberships(selectedClientId)
      .then((rows) => {
        if (active)
          form.setFieldValue('employment', employmentFromMemberships(rows));
      })
      .catch(() => {
        if (active) setEmploymentError(true);
      })
      .finally(() => {
        if (active) setEmploymentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    visible,
    selectedClientId,
    initialEmployment,
    initialClient?.id,
    form,
    employmentRevision,
  ]);

  const handleClientSearch = async (query: string) => {
    const revision = ++searchRevision.current;
    form.setFieldValue('clientId', undefined);
    setClientOptions([]);
    setClientSearchError(false);
    setClientSearchLoading(false);
    form.setFieldValue('employment', undefined);
    if (query.trim().length < 2 || !user) return;
    setClientSearchLoading(true);
    try {
      const clients = await WorkflowService.listClients(user.role, query, 10);
      if (revision !== searchRevision.current) return;
      setClientOptions(
        clients
          .filter((client) => client.clientType !== 'organization')
          .map((client) => ({
            value: `${clientLabel(client)} (${client.email})`,
            label: `${clientLabel(client)} (${client.email})`,
            key: client.id,
          }))
      );
    } catch {
      if (revision === searchRevision.current) setClientSearchError(true);
    } finally {
      if (revision === searchRevision.current) setClientSearchLoading(false);
    }
  };

  const handleCreateCase = async (values: CaseFormValues) => {
    if (!user || loading || employmentLoading || employmentError || officeError)
      return;
    setSubmitError(undefined);
    setLoading(true);
    try {
      const {
        clientId,
        clientSearch: _search,
        firstName,
        lastName,
        email,
        employment,
        fee,
        ...caseFields
      } = values;
      await WorkflowService.createCase(user.role, {
        ...caseFields,
        category: findDepartmentByCaseType(values.title) || 'General',
        ...(fee != null ? { fee: Number(fee) } : {}),
        employment: employment?.maquilaId
          ? employment
          : employmentFromMemberships([]),
        ...(clientMode === 'existing'
          ? { clientId }
          : { firstName, lastName, email }),
      });
      message.success('¡Caso creado exitosamente!');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const data = isAxiosError<{ message?: string; error?: string }>(error)
        ? error.response?.data
        : undefined;
      setSubmitError(
        data?.message ||
          data?.error ||
          'No se pudo crear el caso. Intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Crear Nuevo Caso"
      open={visible}
      onCancel={onClose}
      width={760}
      className={styles.modal}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          disabled={employmentLoading || employmentError || officeError}
          onClick={() => form.submit()}
        >
          Crear Caso
        </Button>,
      ]}
    >
      <p className={styles.intro}>
        Seleccione un cliente o registre uno nuevo y complete los datos del
        caso. Los campos con * son obligatorios.
      </p>
      {submitError && (
        <Alert
          type="error"
          showIcon
          message="No se pudo crear el caso"
          description={submitError}
          className="mb-4"
        />
      )}
      {officeError && (
        <Alert
          type="error"
          showIcon
          message="No se pudieron cargar las oficinas."
          action={
            <Button onClick={() => setOfficeRevision((value) => value + 1)}>
              {ORGANIZATION_TEXT.retry}
            </Button>
          }
          className="mb-4"
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleCreateCase}
        scrollToFirstError={{ block: 'center' }}
        disabled={loading}
      >
        <FormSection title="Cliente">
          <Radio.Group
            aria-label="Tipo de cliente"
            className={styles.mode}
            value={clientMode}
            onChange={(event) => {
              searchRevision.current += 1;
              setClientMode(event.target.value);
              setClientOptions([]);
              setClientSearchLoading(false);
              setClientSearchError(false);
              form.setFieldsValue({
                clientId: undefined,
                clientSearch: '',
                employment: undefined,
              });
            }}
          >
            <Radio value="existing">Cliente Existente</Radio>
            <Radio value="new">Cliente Nuevo</Radio>
          </Radio.Group>
          {clientMode === 'existing' ? (
            <>
              <Form.Item name="clientId" hidden>
                <Input />
              </Form.Item>
              <Form.Item
                name="clientSearch"
                label="Buscar Cliente por Nombre o Correo"
                required
                extra={
                  clientSearchError
                    ? 'No se pudo buscar clientes. Intente escribir de nuevo.'
                    : 'Escriba al menos 2 caracteres y seleccione un cliente de la lista.'
                }
                rules={[
                  {
                    validator: () =>
                      form.getFieldValue('clientId')
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error('Seleccione un cliente de la lista.')
                          ),
                  },
                ]}
              >
                <AutoComplete
                  options={clientOptions}
                  onSearch={handleClientSearch}
                  onSelect={(_value, option) => {
                    searchRevision.current += 1;
                    setClientSearchLoading(false);
                    form.setFieldValue('clientId', option.key);
                    setEmploymentLoading(true);
                    void form
                      .validateFields(['clientSearch'])
                      .catch(() => undefined);
                  }}
                  placeholder="Buscar por nombre o correo"
                  notFoundContent={
                    clientSearchLoading ? (
                      <Spin size="small" />
                    ) : (
                      'Sin resultados'
                    )
                  }
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="firstName"
                    label="Nombre(s)"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'El nombre es requerido.',
                      },
                    ]}
                  >
                    <Input placeholder="Ej. María" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="lastName"
                    label="Apellidos"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Los apellidos son requeridos.',
                      },
                    ]}
                  >
                    <Input placeholder="Ej. García López" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="email"
                label="Correo Electrónico"
                rules={[
                  { required: true, message: 'El correo es requerido.' },
                  { type: 'email', message: 'Ingrese un correo válido.' },
                ]}
              >
                <Input type="email" placeholder="nombre@ejemplo.com" />
              </Form.Item>
            </>
          )}
        </FormSection>

        {employmentError && (
          <Alert
            type="error"
            showIcon
            message={ORGANIZATION_TEXT.employmentLoadFailed}
            action={
              <Button
                onClick={() => setEmploymentRevision((value) => value + 1)}
              >
                {ORGANIZATION_TEXT.retry}
              </Button>
            }
            className="mb-4"
          />
        )}
        <Spin
          wrapperClassName={styles.employment}
          spinning={employmentLoading}
          tip="Cargando datos de maquila…"
        >
          <EmploymentFields
            description={
              clientMode === 'new'
                ? ORGANIZATION_TEXT.newClientEmploymentHint
                : ORGANIZATION_TEXT.caseEmploymentHint
            }
            disabled={
              loading ||
              employmentLoading ||
              employmentError ||
              (clientMode === 'existing' && !selectedClientId)
            }
          />
        </Spin>

        <FormSection title="Datos del caso">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="title"
                label="Tipo de Caso"
                rules={[
                  { required: true, message: 'Seleccione un tipo de caso.' },
                ]}
              >
                <Select
                  placeholder="Seleccione el tipo de caso"
                  showSearch
                  optionFilterProp="children"
                >
                  {Object.entries(CASE_TYPES).map(([department, types]) => (
                    <Select.OptGroup key={department} label={department}>
                      {types.map((type) => (
                        <Select.Option key={type} value={type}>
                          {type}
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                  <Select.OptGroup label="Otro">
                    <Select.Option value="Otro">
                      Otro (Especifique en descripción)
                    </Select.Option>
                  </Select.OptGroup>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="officeId"
                label="Asignar a Oficina"
                rules={[{ required: true, message: 'Seleccione una oficina.' }]}
              >
                <Select
                  placeholder="Seleccione una oficina"
                  disabled={!canAccessAllOffices(user?.role ?? '')}
                  options={offices.map((office) => ({
                    value: office.id,
                    label: office.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          {selectedTitle && (
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message={`Departamento: ${category}`}
              description={
                category === 'Familiar' || category === 'Civil'
                  ? 'Flujo legal: Etapa Inicial → Notificación → Audiencia Preliminar → Audiencia de Juicio → Sentencia'
                  : 'Flujo estándar: Recepción → Consulta Inicial → Revisión de Documentos → Plan de Acción → Resolución → Cerrado'
              }
            />
          )}
          <Form.Item
            name="description"
            label="Descripción Inicial"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'La descripción es obligatoria.',
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Describa la situación del cliente y el apoyo que solicita."
            />
          </Form.Item>
        </FormSection>

        <FormSection title="Datos adicionales" optional>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="fee"
                label="Cuota/Precio"
                tooltip="Se usa en los reportes donde aplique."
              >
                <InputNumber
                  min={0}
                  step={50}
                  className={styles.fullWidth}
                  prefix="$"
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="docketNumber" label="Número de Expediente">
                <Input placeholder="Ej. 589-25" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="court" label="Juzgado">
                <Input placeholder="Ej. 1FXA" />
              </Form.Item>
            </Col>
          </Row>
        </FormSection>
      </Form>
    </Modal>
  );
}
