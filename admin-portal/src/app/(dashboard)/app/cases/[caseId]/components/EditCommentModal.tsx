// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/EditCommentModal.tsx
'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Radio, Button, message } from 'antd';
import { apiClient } from '@/app/lib/api';

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

interface EditCommentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  comment: CaseEvent | null;
}

const EditCommentModal: React.FC<EditCommentModalProps> = ({ 
  visible, 
  onClose, 
  onSuccess, 
  comment 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Set form values when comment changes
  React.useEffect(() => {
    if (comment && visible) {
      form.setFieldsValue({
        commentText: comment.commentText,
        visibility: comment.visibility,
      });
    }
  }, [comment, visible, form]);

  const handleSubmit = async (values: any) => {
    if (!comment) return;

    setLoading(true);
    try {
      await apiClient.put(`/cases/comments/${comment.id}`, {
        comment: values.commentText,
        visibility: values.visibility,
      });
      
      message.success('Comentario actualizado exitosamente.');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al actualizar el comentario';
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
      title="Editar Comentario"
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
          commentText: comment?.commentText || '',
          visibility: comment?.visibility || 'internal',
        }}
      >
        <Form.Item 
          name="commentText" 
          label="Comentario"
          rules={[{ required: true, message: 'El comentario no puede estar vacío' }]}
        >
          <Input.TextArea 
            rows={4} 
            placeholder="Escriba su comentario..." 
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
              Actualizar Comentario
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditCommentModal;
