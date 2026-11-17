// admin-portal/src/app/(dashboard)/admin/cases/components/CreateCaseModal.tsx
'use client';

import { canAccessAllOffices } from '@/config/roles';

import React, { useState, useEffect } from 'react';
import { Alert, Modal, Form, Input, Button, message, Select, Radio, AutoComplete, InputNumber } from 'antd';
import { ORGANIZATION_TEXT } from '@/config/organizations';
import EmploymentFields from '@/components/organizations/EmploymentFields';
import { employmentFromMemberships, clientLabel, type ClientOption, type EmploymentInput } from '@/app/lib/organizations';
import { OrganizationService } from '@/services/organizationService';
import { CASE_TYPES, findDepartmentByCaseType } from '@/app/lib/caseTaxonomy';
import { useAuth } from '@/context/AuthContext';
import { WorkflowService, type WorkflowOffice } from '@/services/workflowService';

const { Option } = Select;

// taxonomy imported from shared module

interface CreateCaseModalProps {
  initialClient?: ClientOption;
  initialEmployment?: EmploymentInput;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ visible, onClose, onSuccess, initialClient, initialEmployment }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [clientDisplay, setClientDisplay] = useState('');
  const [employmentError, setEmploymentError] = useState(false);
  const [employmentRevision, setEmploymentRevision] = useState(0);
  const [employmentLoading, setEmploymentLoading] = useState(false);
  const [clientMode, setClientMode] = useState('existing');
  const [offices, setOffices] = useState<WorkflowOffice[]>([]);
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string; key: number }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (visible) {
      const fetchOffices = async () => {
        if (!user) return;
        try {
          const availableOffices = await WorkflowService.listOffices(user.role);
          setOffices(canAccessAllOffices(user.role ?? '')
            ? availableOffices
            : availableOffices.filter((office) => office.id === user.officeId));
        } catch (error) {
          message.error('No se pudieron cargar las oficinas.');
        }
      };
      fetchOffices();
      // Reset state when modal opens
      setClientMode('existing');
      setSelectedClientId(initialClient?.id || null);
      setClientDisplay(initialClient ? clientLabel(initialClient) : '');
      // Reset form fields
      form.resetFields();
      if (initialClient) form.setFieldsValue({ officeId:initialClient.officeId,employment:initialEmployment });
      // Every non-admin employee creates records only within their assigned office.
      if (!canAccessAllOffices(user?.role ?? '') && user?.officeId) {
        form.setFieldsValue({ officeId: user.officeId });
      }
    }
  }, [visible, form, user, initialClient, initialEmployment]);

  useEffect(() => {
    setEmploymentError(false);
    if (!visible || !selectedClientId || (initialEmployment && selectedClientId === initialClient?.id)) { setEmploymentLoading(false); return; }
    let active = true;
    setEmploymentLoading(true);
    OrganizationService.memberships(selectedClientId)
      .then(rows => { if (active) form.setFieldValue('employment', employmentFromMemberships(rows)); })
      .catch(() => { if (active) setEmploymentError(true); })
      .finally(() => { if (active) setEmploymentLoading(false); });
    return () => { active = false; };
  }, [visible, selectedClientId, initialEmployment, initialClient?.id, form, employmentRevision]);

  const handleClientSearch = async (searchText: string) => {
    setClientDisplay(searchText);
    setSelectedClientId(null);
    if (!searchText || searchText.length < 2) {
      setClientOptions([]);
      return;
    }
    if (!user) return;
    try {
      const clients = await WorkflowService.listClients(user.role, searchText, 10);
      const clientOptions = clients.filter(client => client.clientType !== 'organization').map(client => ({
        value: `${client.firstName} ${client.lastName} (${client.email})`,
        label: `${client.firstName} ${client.lastName} (${client.email})`,
        key: client.id,
      }));
      setClientOptions(clientOptions);
    } catch (error) {
      console.error("Client search failed:", error);
      message.error('Error al buscar clientes. Intente nuevamente.');
    }
  };

  const handleClientSelect = (value: string, option: any) => {
    setSelectedClientId(option.key);
    setClientDisplay(value);
  };

  const handleCreateCase = async () => {
    try {
      if (!user) throw new Error('Usuario no autenticado.');
      const values = await form.validateFields();
      setLoading(true);
      message.loading({ content: 'Creando caso...', key: 'createCase' });

      let payload: any = {
        officeId: values.officeId,
        title: values.title,
        category: values.category, // Use the category field directly
        description: values.description,
        employment: values.employment?.maquilaId ? values.employment : {maquilaId:null,employeeNumber:'',shiftName:'',shiftStart:'',shiftEnd:''},
      };

      if (values.fee !== undefined) {
        payload.fee = Number(values.fee);
      }
      
      // Handle docket number and court - allow empty values
      if (values.docketNumber !== undefined) {
        payload.docketNumber = values.docketNumber;
      }
      if (values.court !== undefined) {
        payload.court = values.court;
      }

      if (clientMode === 'existing') {
        if (!selectedClientId) {
          throw new Error('Por favor, seleccione un cliente de la lista.');
        }
        payload.clientId = selectedClientId;
      } else {
        payload.firstName = values.firstName;
        payload.lastName = values.lastName;
        payload.email = values.email;
      }
      
      await WorkflowService.createCase(user.role, payload);
      
      message.success({ content: '¡Caso creado exitosamente!', key: 'createCase' });
      onSuccess();
      onClose();
      form.resetFields();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Ocurrió un error.';
      message.error({ content: errorMessage, key: 'createCase' });
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = Form.useWatch('category', form);

  return (
    <Modal
      title="Crear Nuevo Caso"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="back" onClick={onClose}>Cancelar</Button>,
        <Button key="submit" type="primary" loading={loading || employmentLoading} disabled={employmentError} onClick={handleCreateCase}>Crear Caso</Button>,
      ]}
    >
      {employmentError && <Alert type="error" showIcon message={ORGANIZATION_TEXT.employmentLoadFailed} action={<Button onClick={() => setEmploymentRevision(value => value + 1)}>{ORGANIZATION_TEXT.retry}</Button>} className="mb-4" />}
      <Form form={form} layout="vertical">
        <Form.Item label="Cliente">
          <Radio.Group onChange={(e) => {
            setClientMode(e.target.value);
            setSelectedClientId(null);
            setClientDisplay('');
            form.setFieldValue('employment', undefined);
          }} value={clientMode}>
            <Radio value="existing">Cliente Existente</Radio>
            <Radio value="new">Cliente Nuevo</Radio>
          </Radio.Group>
        </Form.Item>

        {clientMode === 'existing' ? (
          <Form.Item label="Buscar Cliente por Nombre o Correo">
            <AutoComplete
              value={clientDisplay}
              onChange={setClientDisplay}
              options={clientOptions}
              onSelect={handleClientSelect}
              onSearch={handleClientSearch}
              placeholder="Escriba para buscar..."
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item name="firstName" label="Nombre(s)" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Correo Electrónico" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
          </>
        )}
        
        <hr className="my-6" />

        {/* Department -> Case Type taxonomy selector */}
        <Form.Item name="title" label="Tipo de Caso" rules={[{ required: true, message: 'Por favor, seleccione un tipo de caso' }]}>
          <Select 
            placeholder="Seleccione el tipo de caso"
            showSearch
            optionFilterProp="children"
            onChange={(value: string) => {
              const dept = findDepartmentByCaseType(value) || 'General';
              form.setFieldsValue({ category: dept });
            }}
          >
            {Object.entries(CASE_TYPES).map(([dept, types]) => (
              <Select.OptGroup key={dept} label={dept}>
                {types.map((t) => (
                  <Option key={t} value={t}>{t}</Option>
                ))}
              </Select.OptGroup>
            ))}
            <Select.OptGroup label="Otro">
              <Option value="Otro">Otro (Especifique en descripción)</Option>
            </Select.OptGroup>
          </Select>
        </Form.Item>

        {/* Hidden category (department) - auto-synced from case type */}
        <Form.Item name="category" hidden={true}>
          <Input />
        </Form.Item>

        {/* Show stage workflow information based on category */}
        {selectedCategory && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <strong>Flujo de Etapas:</strong>
              {selectedCategory === 'Familiar' || selectedCategory === 'Civil' ? (
                <span> Este caso seguirá el flujo legal: Etapa Inicial → Notificación → Audiencia Preliminar → Audiencia de Juicio → Sentencia</span>
              ) : (
                <span> Este caso seguirá el flujo estándar: Recepción → Consulta Inicial → Revisión de Documentos → Plan de Acción → Resolución → Cerrado</span>
              )}
            </div>
          </div>
        )}

        <Form.Item name="fee" label="Cuota/Precio (Opcional)" tooltip="Campo opcional para cualquier tipo de caso; se usa en reportes donde aplique">
          <InputNumber min={0} step={50} style={{ width: '100%' }} prefix="$" />
        </Form.Item>

        <Form.Item name="docketNumber" label="Número de Expediente (Opcional)" tooltip="Número de expediente del caso legal (ej. 589-25)">
          <Input placeholder="Ej: 589-25" />
        </Form.Item>

        <Form.Item name="court" label="Juzgado (Opcional)" tooltip="Juzgado donde se tramita el caso (ej. 1FXA)">
          <Input placeholder="Ej: 1FXA" />
        </Form.Item>

        <Form.Item name="officeId" label="Asignar a Oficina" rules={[{ required: true, message: 'Por favor, seleccione una oficina' }]}>
          <Select
            placeholder="Seleccione una oficina"
            disabled={!canAccessAllOffices(user?.role ?? '')}
          >
            {offices && offices.length > 0 && offices.map(office => (
              <Option key={office.id} value={office.id}>{office.name}</Option>
            ))}
            {!canAccessAllOffices(user?.role ?? '') && user?.officeId && offices.length === 0 && (
              <Option key={user.officeId} value={user.officeId}>Mi Oficina</Option>
            )}
          </Select>
        </Form.Item>
        <EmploymentFields />
        <Form.Item name="description" label="Descripción Inicial" rules={[{ required: true, message: 'La descripción es obligatoria' }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateCaseModal;

