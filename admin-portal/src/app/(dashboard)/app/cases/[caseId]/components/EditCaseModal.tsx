// admin-portal/src/app/(dashboard)/app/cases/[caseId]/components/EditCaseModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Select } from 'antd';
import { apiClient } from '@/app/lib/api';
import { CASE_TYPES } from '@/app/lib/caseTaxonomy';

const { Option } = Select;

interface EditCaseModalProps {
  visible: boolean;
  caseId: string;
  caseData: {
    title: string;
    category: string;
    docketNumber?: string;
    court?: string;
    description: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const EditCaseModal: React.FC<EditCaseModalProps> = ({ 
  visible, 
  caseId, 
  caseData, 
  onClose, 
  onSuccess 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && caseData) {
      form.setFieldsValue({
        title: caseData.title,
        category: caseData.category,
        docketNumber: caseData.docketNumber || '',
        court: caseData.court || '',
        description: caseData.description,
      });
    }
  }, [visible, caseData, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      message.loading({ content: 'Actualizando caso...', key: 'updateCase' });

      const payload: any = {
        title: values.title,
        category: values.category,
        description: values.description,
      };

      // Handle docket number and court - allow setting to empty string to clear them
      if (values.docketNumber !== undefined) {
        payload.docketNumber = values.docketNumber;
      }
      if (values.court !== undefined) {
        payload.court = values.court;
      }

      const response = await apiClient.put(`/admin/cases/${caseId}`, payload);
      
      message.success({ content: '¡Caso actualizado exitosamente!', key: 'updateCase' });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('EditCaseModal: Update error:', error);
      console.error('EditCaseModal: Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || 'Ocurrió un error al actualizar el caso.';
      message.error({ content: errorMessage, key: 'updateCase' });
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
      title="Editar Caso"
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="back" onClick={handleCancel} disabled={loading}>
          Cancelar
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          Guardar Cambios
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item 
          name="title" 
          label="Título del Caso" 
          rules={[{ required: true, message: 'El título es requerido' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item 
          name="category" 
          label="Departamento" 
          rules={[{ required: true, message: 'El departamento es requerido' }]}
        >
          <Select placeholder="Seleccione departamento">
            <Option value="Familiar">Familiar</Option>
            <Option value="Civil">Civil</Option>
            <Option value="Psicologia">Psicología</Option>
            <Option value="Recursos">Recursos</Option>
          </Select>
        </Form.Item>

        {/* Show stage workflow information based on category */}
        <Form.Item shouldUpdate={(prev, curr) => prev.category !== curr.category} noStyle>
          {() => {
            const selectedCategory = form.getFieldValue('category');
            if (selectedCategory) {
              return (
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
              );
            }
            return null;
          }}
        </Form.Item>

        <Form.Item 
          name="docketNumber" 
          label="Número de Expediente (Opcional)"
          tooltip="Número de expediente del caso legal (ej. 589-25)"
        >
          <Input placeholder="Ej: 589-25" />
        </Form.Item>

        <Form.Item 
          name="court" 
          label="Juzgado (Opcional)"
          tooltip="Juzgado donde se tramita el caso (ej. 1FXA)"
        >
          <Input placeholder="Ej: 1FXA" />
        </Form.Item>

        <Form.Item 
          name="description" 
          label="Descripción" 
          rules={[{ required: true, message: 'La descripción es requerida' }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditCaseModal;
