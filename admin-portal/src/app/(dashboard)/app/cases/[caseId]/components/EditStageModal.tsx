// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/EditStageModal.tsx (New File)
'use client';

import React, { useState } from 'react';
import { Modal, Form, Select, Button, message } from 'antd';
import { apiClient } from '../../../../../lib/api';

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

  const handleUpdateStage = async (values: any) => {
    setLoading(true);
    message.loading({ content: 'Actualizando etapa...', key: 'updateStage' });

    try {
      await apiClient.patch(`/admin/cases/${caseId}/stage`, { stage: values.stage });
      message.success({ content: '¡Etapa actualizada exitosamente!', key: 'updateStage' });
      onSuccess();
      onClose();
    } catch (error) {
      message.error({ content: 'No se pudo actualizar la etapa.', key: 'updateStage' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Actualizar Etapa del Caso"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={() => form.submit()}>
          Guardar Cambios
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" onFinish={handleUpdateStage} initialValues={{ stage: currentStage }}>
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