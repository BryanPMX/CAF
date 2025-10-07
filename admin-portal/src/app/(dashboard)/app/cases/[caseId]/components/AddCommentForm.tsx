// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/AddCommentForm.tsx (New File)
'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Radio, message } from 'antd';
import { CommentService, CommentCreateRequest } from '@/services/commentService';
import { useAuth } from '@/context/AuthContext';

interface AddCommentFormProps {
  caseId: string;
  onSuccess: () => void; // Callback to refresh the timeline
}

const AddCommentForm: React.FC<AddCommentFormProps> = ({ caseId, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAddComment = async (values: any) => {
    if (!user) {
      message.error('Usuario no autenticado');
      return;
    }

    setLoading(true);
    try {
      const commentData: CommentCreateRequest = {
        comment: values.commentText,
        visibility: values.visibility,
      };
      await CommentService.createComment(user.role, caseId, commentData);
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
