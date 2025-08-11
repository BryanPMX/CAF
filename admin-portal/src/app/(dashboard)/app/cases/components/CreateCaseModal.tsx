// admin-portal/src/app/(dashboard)/admin/cases/components/CreateCaseModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Select, Radio, Spin, AutoComplete } from 'antd';
import { apiClient } from '../../../../lib/api';

const { Option } = Select;

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
    }
  }, [visible]);

  const handleClientSearch = async (searchText: string) => {
    if (!searchText || searchText.length < 2) {
      setClientOptions([]);
      return;
    }
    try {
      // TODO: Create GET /api/v1/admin/users/search?q=... endpoint in Go
      const response = await apiClient.get(`/admin/users`);
      const allUsers: Client[] = response.data;
      const filteredClients = allUsers
        .filter(user => 
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchText.toLowerCase()) ||
          user.email.toLowerCase().includes(searchText.toLowerCase())
        )
        .map(client => ({
          value: `${client.firstName} ${client.lastName} (${client.email})`,
          label: `${client.firstName} ${client.lastName} (${client.email})`,
          key: client.id,
        }));
      setClientOptions(filteredClients);
    } catch (error) {
      console.error("Client search failed:", error);
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
        description: values.description,
      };

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

        {/* --- UPDATED: Changed from Input to Select Dropdown --- */}
        <Form.Item name="title" label="Título del Caso" rules={[{ required: true, message: 'Por favor, seleccione un título' }]}>
          <Select placeholder="Seleccione el tipo de caso">
            <Option value="Consulta Legal - Familiar">Consulta Legal - Familiar</Option>
            <Option value="Consulta Legal - Civil">Consulta Legal - Civil</Option>
            <Option value="Consulta Legal - Migratoria">Consulta Legal - Migratoria</Option>
            <Option value="Consulta Psicológica - Individual">Consulta Psicológica - Individual</Option>
            <Option value="Consulta Psicológica - Pareja/Familiar">Consulta Psicológica - Pareja/Familiar</Option>
            <Option value="Asistencia Social - Recursos">Asistencia Social - Recursos</Option>
            <Option value="Otro">Otro (Especifique en descripción)</Option>
          </Select>
        </Form.Item>

        <Form.Item name="officeId" label="Asignar a Oficina" rules={[{ required: true, message: 'Por favor, seleccione una oficina' }]}>
          <Select placeholder="Seleccione una oficina">
            {offices.map(office => (
              <Option key={office.id} value={office.id}>{office.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="description" label="Descripción Inicial">
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateCaseModal;

