'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, TimePicker, Button, message, Space } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { Appointment, User } from '@/app/lib/types';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface EditAppointmentModalProps {
  visible: boolean;
  appointment: Appointment | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface EditAppointmentFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  staffId: number;
  clientId: number;
  caseId?: number;
  notes?: string;
}

const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({
  visible,
  appointment,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [clients, setClients] = useState<User[]>([]);

  useEffect(() => {
    if (visible) {
      fetchSupportingData();
      if (appointment) {
        form.setFieldsValue({
          title: appointment.title,
          description: appointment.description,
          date: dayjs(appointment.date),
          time: dayjs(appointment.time, 'HH:mm'),
          duration: appointment.duration,
          status: appointment.status,
          staffId: appointment.staffId,
          clientId: appointment.clientId,
          caseId: appointment.caseId,
          notes: appointment.notes
        });
      }
    }
  }, [visible, appointment, form]);

  const fetchSupportingData = async () => {
    try {
      const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'admin';
      const base = role === 'office_manager' ? '/manager' : '/admin';
      // Fetch staff members
      const staffRes = await apiClient.get(`${base}/users`);
      const staffPayload = Array.isArray(staffRes.data) ? staffRes.data : (staffRes.data?.users || []);
      setStaffList(staffPayload.filter((user: User) => user.role !== 'client'));

      // Fetch clients
      const clientsRes = await apiClient.get(`${base}/users?role=client`);
      const clientsPayload = Array.isArray(clientsRes.data) ? clientsRes.data : (clientsRes.data?.users || []);
      setClients(clientsPayload);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Error al cargar datos de apoyo';
      message.error(`Error al cargar datos de apoyo: ${errorMessage}`);
    }
  };

  const handleSubmit = async (values: EditAppointmentFormData) => {
    if (!appointment) return;

    setLoading(true);
    try {
      const payload = {
        ...values,
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : undefined,
        time: values.time ? dayjs(values.time).format('HH:mm') : undefined,
      };

      await apiClient.patch(`/appointments/${appointment.id}`, payload);
      
      message.success('Cita actualizada exitosamente');
      onSuccess();
      onCancel();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Error al actualizar cita';
      message.error(`Error al actualizar cita: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // Get client name for display
  const getClientName = (appointment: Appointment | null) => {
    if (!appointment) return '';
    const client = clients.find(c => c.id === appointment.clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Cliente no encontrado';
  };

  // Get staff name for display
  const getStaffName = (appointment: Appointment | null) => {
    if (!appointment) return '';
    const staff = staffList.find(s => s.id === appointment.staffId);
    return staff ? `${staff.firstName} ${staff.lastName}` : 'Personal no encontrado';
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          Editar Cita
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      {appointment && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">
            <div><strong>Cliente:</strong> {getClientName(appointment)}</div>
            <div><strong>Personal:</strong> {getStaffName(appointment)}</div>
            <div><strong>Estado actual:</strong> {appointment.status}</div>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          status: 'scheduled',
          duration: 60
        }}
      >
        <Form.Item
          name="title"
          label="Título"
          rules={[{ required: true, message: 'Por favor ingrese el título' }]}
        >
          <Input placeholder="Título de la cita" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Descripción"
        >
          <TextArea 
            rows={3} 
            placeholder="Descripción de la cita"
          />
        </Form.Item>

        <Form.Item
          name="date"
          label="Fecha"
          rules={[{ required: true, message: 'Por favor seleccione la fecha' }]}
        >
          <DatePicker 
            style={{ width: '100%' }} 
            placeholder="Seleccionar fecha"
          />
        </Form.Item>

        <Form.Item
          name="time"
          label="Hora"
          rules={[{ required: true, message: 'Por favor seleccione la hora' }]}
        >
          <TimePicker 
            style={{ width: '100%' }} 
            placeholder="Seleccionar hora"
            format="HH:mm"
          />
        </Form.Item>

        <Form.Item
          name="duration"
          label="Duración (minutos)"
          rules={[{ required: true, message: 'Por favor ingrese la duración' }]}
        >
          <Select placeholder="Seleccionar duración">
            <Option value={30}>30 minutos</Option>
            <Option value={60}>1 hora</Option>
            <Option value={90}>1.5 horas</Option>
            <Option value={120}>2 horas</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="status"
          label="Estado"
          rules={[{ required: true, message: 'Por favor seleccione el estado' }]}
        >
          <Select placeholder="Seleccionar estado">
            <Option value="scheduled">Programada</Option>
            <Option value="confirmed">Confirmada</Option>
            <Option value="completed">Completada</Option>
            <Option value="cancelled">Cancelada</Option>
            <Option value="no-show">No asistió</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="staffId"
          label="Personal Asignado"
          rules={[{ required: true, message: 'Por favor seleccione el personal' }]}
        >
          <Select placeholder="Seleccionar personal">
            {staffList.map(staff => (
              <Option key={staff.id} value={staff.id}>
                {staff.firstName} {staff.lastName} ({staff.role})
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="clientId"
          label="Cliente"
          rules={[{ required: true, message: 'Por favor seleccione el cliente' }]}
        >
          <Select placeholder="Seleccionar cliente">
            {clients.map(client => (
              <Option key={client.id} value={client.id}>
                {client.firstName} {client.lastName}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="caseId"
          label="Caso (Opcional)"
        >
          <Select placeholder="Seleccionar caso" allowClear>
            {/* This would need to be populated with actual cases */}
            <Option value={1}>Caso de ejemplo</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="notes"
          label="Notas"
        >
          <TextArea 
            rows={3} 
            placeholder="Notas adicionales"
          />
        </Form.Item>

        <Form.Item className="mb-0">
          <Space className="w-full justify-end">
            <Button onClick={handleCancel} icon={<CloseOutlined />}>
              Cancelar
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<SaveOutlined />}
            >
              Guardar Cambios
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditAppointmentModal; 