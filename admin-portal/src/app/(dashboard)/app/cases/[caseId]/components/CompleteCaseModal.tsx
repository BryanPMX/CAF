// admin-portal/src/app/(dashboard)/app/cases/[caseId]/components/CompleteCaseModal.tsx
'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Button, message, Typography, Alert } from 'antd';
import { CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CompleteCaseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  caseId: number;
  caseTitle: string;
}

const CompleteCaseModal: React.FC<CompleteCaseModalProps> = ({
  visible,
  onClose,
  onSuccess,
  caseId,
  caseTitle
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      await apiClient.post(`/admin/cases/${caseId}/complete`, {
        completionNote: values.completionNote,
      });
      
      message.success('Caso completado y archivado exitosamente');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error completing case:', error);
      const errorMessage = error.response?.data?.error || 'Error al completar el caso';
      message.error(errorMessage);
      
      // If it's a permission error, show more specific message
      if (error.response?.status === 403) {
        message.error('No tiene permisos para completar este caso. Solo administradores y gerentes de oficina pueden completar casos.');
      }
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
      title={
        <div className="flex items-center space-x-2">
          <CheckCircleOutlined className="text-green-500" />
          <Title level={4} className="mb-0">Completar Caso</Title>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <div className="mb-4">
        <Alert
          message="Confirmación de Completado"
          description={
            <div>
              <p>Al completar este caso:</p>
              <ul className="list-disc list-inside mt-2">
                <li>El caso se marcará como <strong>completado</strong></li>
                <li>Se moverá automáticamente a <strong>Archivos</strong></li>
                <li>Ya no aparecerá en la lista de casos activos</li>
                <li>Se mantendrá como registro permanente</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          className="mb-4"
        />
        
        <div className="bg-gray-50 p-3 rounded-md mb-4">
          <Text strong>Caso: </Text>
          <Text>{caseTitle}</Text>
        </div>
      </div>

      <Form
        form={form}
        onFinish={handleSubmit}
        layout="vertical"
      >
        <Form.Item
          name="completionNote"
          label="Nota de Completado"
          rules={[
            { required: true, message: 'La nota de completado es requerida' },
            { min: 10, message: 'La nota debe tener al menos 10 caracteres' }
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Describa brevemente cómo se completó el caso, incluyendo el resultado final..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item className="mb-0">
          <div className="flex justify-end space-x-2">
            <Button onClick={handleCancel}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<CheckCircleOutlined />}
            >
              Completar y Archivar
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CompleteCaseModal;
