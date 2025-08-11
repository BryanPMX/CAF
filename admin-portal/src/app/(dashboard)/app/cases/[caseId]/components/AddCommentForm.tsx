// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/AddCommentForm.tsx (New File)
'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Radio, message } from 'antd';
import { apiClient } from '../../../../../lib/api';

interface AddCommentFormProps {
  caseId: string;
  onSuccess: () => void; // Callback to refresh the timeline
}

const AddCommentForm: React.FC<AddCommentFormProps> = ({ caseId, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleAddComment = async (values: any) => {
    setLoading(true);
    try {
      await apiClient.post(`/admin/cases/${caseId}/comments`, {
        comment: values.commentText,
        visibility: values.visibility,
      });
      message.success('Comentario añadido exitosamente.');
      form.resetFields();
      onSuccess(); // Trigger the refresh
    } catch (error) {
      message.error('No se pudo añadir el comentario.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} onFinish={handleAddComment} layout="vertical">
      <Form.Item name="commentText" rules={[{ required: true, message: 'El comentario no puede estar vacío' }]}>
        <Input.TextArea rows={3} placeholder="Escriba una actualización o nota interna..." />
      </Form.Item>
      <Form.Item name="visibility" initialValue="internal" rules={[{ required: true }]}>
        <Radio.Group>
          <Radio value="internal">Solo para Staff (Interno)</Radio>
          <Radio value="client_visible">Visible para el Cliente</Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Añadir Comentario
        </Button>
      </Form.Item>
    </Form>
  );
};

export default AddCommentForm;
