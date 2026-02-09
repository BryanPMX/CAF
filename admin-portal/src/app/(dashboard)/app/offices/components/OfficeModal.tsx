// admin-portal/src/app/(dashboard)/admin/offices/components/OfficeModal.tsx (New File)
'use client';

import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { apiClient } from '@/app/lib/api';

interface Office {
  id: number;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface OfficeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  office?: Office | null; // Pass an office object when editing
}

const OfficeModal: React.FC<OfficeModalProps> = ({ visible, onClose, onSuccess, office }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const isEditing = !!office;

  // This effect runs when the modal opens or the 'office' prop changes.
  // It populates the form with the office data when in edit mode.
  useEffect(() => {
    if (visible) {
      if (office) {
        form.setFieldsValue(office);
      } else {
        form.resetFields();
      }
    }
  }, [visible, office, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // Convert lat/lng strings to numbers for API
      const payload = { ...values };
      if (values.latitude !== undefined && values.latitude !== '' && values.latitude !== null) {
        payload.latitude = parseFloat(values.latitude);
      } else {
        payload.latitude = null;
      }
      if (values.longitude !== undefined && values.longitude !== '' && values.longitude !== null) {
        payload.longitude = parseFloat(values.longitude);
      } else {
        payload.longitude = null;
      }
      setLoading(true);
      const messageKey = isEditing ? 'updateOffice' : 'createOffice';
      message.loading({ content: 'Guardando...', key: messageKey });

      if (isEditing) {
        // If editing, send a PATCH request to the update endpoint
        await apiClient.patch(`/admin/offices/${office.id}`, payload);
      } else {
        // If creating, send a POST request
        await apiClient.post('/admin/offices', payload);
      }

      message.success({ content: `¡Oficina ${isEditing ? 'actualizada' : 'creada'} exitosamente!`, key: messageKey });
      onSuccess(); // Refresh the list on the parent page
      onClose(); // Close the modal
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Ocurrió un error.';
      message.error({ content: errorMessage, key: 'createOffice' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEditing ? 'Editar Oficina' : 'Crear Nueva Oficina'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Nombre de la Oficina"
          rules={[{ required: true, message: 'El nombre es requerido' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="address"
          label="Dirección"
          rules={[{ required: true, message: 'La dirección es requerida' }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          name="latitude"
          label="Latitud (opcional)"
          help="Para el mapa de la página de contacto. Ej: 31.6904"
        >
          <Input type="number" step="any" placeholder="31.6904" />
        </Form.Item>
        <Form.Item
          name="longitude"
          label="Longitud (opcional)"
          help="Para el mapa de la página de contacto. Ej: -106.4245"
        >
          <Input type="number" step="any" placeholder="-106.4245" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default OfficeModal;