// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/EditStageModal.tsx (New File)
'use client';

import React, { useState } from 'react';
import { Modal, Form, Select, Button, message } from 'antd';
import { apiClient } from '@/app/lib/api';

const { Option } = Select;

interface EditStageModalProps {
  visible: boolean;
  caseId: string;
  currentStage: string;
  allStages: string[];
  stageLabels: { [key: string]: string };
  onClose: () => void;
  onSuccess: () => void;
}

const EditStageModal: React.FC<EditStageModalProps> = ({ visible, caseId, currentStage, allStages, stageLabels, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      form.setFieldsValue({ stage: currentStage });
    }
  }, [visible, currentStage, form]);

  const handleUpdateStage = async (values: any) => {
    setLoading(true);
    message.loading({ content: 'Guardando...', key: 'updateStage' });

    try {
      const requestData = { stage: values.stage };
      
      const response = await apiClient.patch(`/admin/cases/${caseId}/stage`, requestData);
      
      message.success({ content: '¡Etapa actualizada exitosamente!', key: 'updateStage' });
      
      // Close modal first
      onClose();
      
      // Wait a moment for backend to process the update, then refresh data
      setTimeout(() => {
        onSuccess();
      }, 500); // 500ms delay to ensure backend has processed the update
    } catch (error: any) {
      console.error('Error updating stage:', error);
      const errorMessage = error.response?.data?.error || error.message || 'No se pudo actualizar la etapa.';
      message.error({ content: errorMessage, key: 'updateStage' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Editar Etapa del Caso"
      open={visible}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleUpdateStage}>
        <Form.Item
          name="stage"
          label="Nueva Etapa"
          rules={[{ required: true, message: 'Por favor, seleccione una etapa' }]}
        >
          <Select>
            {allStages.map(stage => (
              <Option key={stage} value={stage}>{stageLabels[stage] || stage}</Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditStageModal;