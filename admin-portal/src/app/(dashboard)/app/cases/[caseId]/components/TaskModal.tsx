// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/TaskModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Select, DatePicker } from 'antd';
import { apiClient } from '@/app/lib/api';
import dayjs from 'dayjs'; // We need dayjs to handle date objects for the DatePicker

const { Option } = Select;

// Define the data structures for clarity
interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
}
interface Task {
  id: number;
  title: string;
  assignedTo: StaffMember; // The API returns a nested object
  dueDate?: string | null;
  status: string;
}

interface TaskModalProps {
  visible: boolean;
  caseId: string;
  onClose: () => void;
  onSuccess: () => void;
  task?: Task | null;
}

const TaskModal: React.FC<TaskModalProps> = ({ visible, caseId, onClose, onSuccess, task }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const isEditing = !!task;

  // This effect runs when the modal opens
  useEffect(() => {
    if (visible) {
      const fetchStaff = async () => {
        try {
          const response = await apiClient.get('/admin/users');
          // The API returns { data: [...], pagination: {...} }
          const users = response.data.data || [];
          const staff = users.filter((user: any) => user.role !== 'client');
          // Staff data loaded successfully
          setStaffList(staff);
        } catch (error) {
          console.error('Error fetching staff:', error); // Debug log
          message.error('No se pudo cargar la lista de personal.');
        }
      };
      fetchStaff();

      // If we are editing an existing task, populate the form with its data
      if (isEditing) {
        form.setFieldsValue({
          title: task.title,
          // --- THIS IS THE FIX ---
          // We explicitly tell the form to use the ID from the nested 'assignedTo' object
          // for the 'assignedToId' field.
          assignedToId: task.assignedTo.id,
          status: task.status,
          // Convert the date string from the API back into a dayjs object for the DatePicker
          dueDate: task.dueDate ? dayjs(task.dueDate) : null,
        });
      } else {
        // If creating, ensure the form is empty
        form.resetFields();
      }
    }
  }, [visible, task, form, isEditing]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const messageKey = isEditing ? 'updateTask' : 'createTask';
      message.loading({ content: 'Guardando...', key: messageKey });

      // Prepare the data payload for the API
      const payload = {
        caseId: parseInt(caseId), // Add the missing caseId
        title: values.title,
        assignedToId: values.assignedToId,
        status: values.status || 'pending', // Default to 'pending' if creating
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
      };

      if (isEditing) {
        await apiClient.patch(`/admin/tasks/${task.id}`, payload);
      } else {
        // Task creation initiated
        await apiClient.post(`/admin/cases/${caseId}/tasks`, payload);
      }

      message.success({ content: `¡Tarea ${isEditing ? 'actualizada' : 'creada'}!`, key: messageKey });
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Ocurrió un error.';
      message.error({ content: errorMessage, key: 'createTask' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEditing ? 'Editar Tarea' : 'Crear Nueva Tarea'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Título" rules={[{ required: true, message: 'El título es requerido' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="assignedToId" label="Asignar a" rules={[{ required: true, message: 'Debe asignar la tarea' }]}>
          <Select placeholder="Seleccione un miembro del personal">
            {staffList.map(s => <Option key={s.id} value={s.id}>{`${s.firstName} ${s.lastName}`}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="dueDate" label="Fecha Límite (Opcional)">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        {/* The status field is only shown when editing a task */}
        {isEditing && (
          <Form.Item name="status" label="Estado" rules={[{ required: true, message: 'El estado es requerido' }]}>
            <Select>
              <Option value="pending">Pendiente</Option>
              <Option value="in_progress">En Progreso</Option>
              <Option value="completed">Completada</Option>
            </Select>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default TaskModal;


