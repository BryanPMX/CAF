// admin-portal/src/app/(dashboard)/admin/cases/components/CreateCaseModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Select, Radio, Spin, AutoComplete, InputNumber } from 'antd';
import { apiClient } from '@/app/lib/api';
import { CASE_TYPES, findDepartmentByCaseType } from '@/app/lib/caseTaxonomy';

const { Option } = Select;

// taxonomy imported from shared module

interface Office {
  id: number;
  name: string;
}

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface CreateCaseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [clientMode, setClientMode] = useState('existing');
  const [offices, setOffices] = useState<Office[]>([]);
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string; key: number }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      const fetchOffices = async () => {
        try {
          const response = await apiClient.get('/admin/offices');
          setOffices(response.data);
        } catch (error) {
          message.error('No se pudieron cargar las oficinas.');
        }
      };
      fetchOffices();
      // Reset state when modal opens
      setClientMode('existing');
      setSelectedClientId(null);
      // Reset form fields
      form.resetFields();
      // Prefill office for office managers
      if (typeof window !== 'undefined') {
        const officeId = localStorage.getItem('userOfficeId');
        if (officeId) {
          form.setFieldsValue({ officeId: Number(officeId) });
        }
      }
    }
  }, [visible, form]);

  const handleClientSearch = async (searchText: string) => {
    if (!searchText || searchText.length < 2) {
      setClientOptions([]);
      return;
    }
    try {
      // Use the proper client search endpoint
      const response = await apiClient.get(`/admin/users/search?q=${encodeURIComponent(searchText)}`);
      
      const clients: Client[] = Array.isArray(response.data) ? response.data : [];
      const clientOptions = clients.map(client => ({
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
  };

  const handleCreateCase = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      message.loading({ content: 'Creando caso...', key: 'createCase' });

      let payload: any = {
        officeId: values.officeId,
        title: values.title,
        category: values.category, // Use the category field directly
        description: values.description,
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
      
      await apiClient.post('/admin/cases', payload);
      
      message.success({ content: '¡Caso creado exitosamente!', key: 'createCase' });
      onSuccess();
      onClose();
      form.resetFields();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Ocurrió un error.';
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
        <Button key="submit" type="primary" loading={loading} onClick={handleCreateCase}>Crear Caso</Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Cliente">
          <Radio.Group onChange={(e) => setClientMode(e.target.value)} value={clientMode}>
            <Radio value="existing">Cliente Existente</Radio>
            <Radio value="new">Cliente Nuevo</Radio>
          </Radio.Group>
        </Form.Item>

        {clientMode === 'existing' ? (
          <Form.Item label="Buscar Cliente por Nombre o Correo">
            <AutoComplete
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
            disabled={typeof window !== 'undefined' && localStorage.getItem('userRole') === 'office_manager'}
          >
            {offices && offices.length > 0 && offices.map(office => (
              <Option key={office.id} value={office.id}>{office.name}</Option>
            ))}
            {typeof window !== 'undefined' && localStorage.getItem('userRole') === 'office_manager' && (() => {
              const officeId = localStorage.getItem('userOfficeId');
              return officeId ? <Option key={officeId} value={Number(officeId)}>Mi Oficina</Option> : null;
            })()}
          </Select>
        </Form.Item>
        <Form.Item name="description" label="Descripción Inicial" rules={[{ required: true, message: 'La descripción es obligatoria' }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateCaseModal;

