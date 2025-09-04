// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/EditDocumentModal.tsx
'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Radio, Button, message } from 'antd';
import { apiClient } from '../../../../../lib/api';

interface User {
  firstName: string;
  lastName: string;
}

interface CaseEvent {
  id: number;
  eventType: string;
  visibility: string;
  commentText?: string;
  fileName?: string;
  fileUrl?: string;
  createdAt: string;
  user: User;
}

interface EditDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  document: CaseEvent | null;
}

const EditDocumentModal: React.FC<EditDocumentModalProps> = ({ 
  visible, 
  onClose, 
  onSuccess, 
  document 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Set form values when document changes
  React.useEffect(() => {
    if (document && visible) {
      form.setFieldsValue({
        fileName: document.fileName,
        visibility: document.visibility,
      });
    }
  }, [document, visible, form]);

  const handleSubmit = async (values: any) => {
    if (!document) return;

    setLoading(true);
    try {
      await apiClient.put(`/cases/documents/${document.id}`, {
        fileName: values.fileName,
        visibility: values.visibility,
      });
      
      message.success('Documento actualizado exitosamente.');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al actualizar el documento';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Editar Documento"
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={600}
    >
      <Form 
        form={form} 
        onFinish={handleSubmit} 
        layout="vertical"
        initialValues={{
          fileName: document?.fileName || '',
          visibility: document?.visibility || 'internal',
        }}
      >
        <Form.Item 
          name="fileName" 
          label="Nombre del Archivo"
          rules={[{ required: true, message: 'El nombre del archivo es requerido' }]}
        >
          <Input 
            placeholder="Ingrese el nombre del archivo..." 
          />
        </Form.Item>
        
        <Form.Item 
          name="visibility" 
          label="Visibilidad"
          rules={[{ required: true, message: 'Seleccione la visibilidad' }]}
        >
          <Radio.Group>
            <Radio value="internal">Solo para Staff (Interno)</Radio>
            <Radio value="client_visible">Visible para el Cliente</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item className="mb-0">
          <div className="flex justify-end space-x-2">
            <Button onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Actualizar Documento
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditDocumentModal;
