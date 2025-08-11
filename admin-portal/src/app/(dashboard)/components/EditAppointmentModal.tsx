import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Select, DatePicker } from 'antd';
import { apiClient } from '../../lib/api';
import dayjs from 'dayjs';

const { Option } = Select;

interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

interface Appointment {
  id: number;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  caseId: number;
  staffId: number;
  case?: {
    client?: {
      firstName: string;
      lastName: string;
    };
    title: string;
  };
  staff?: {
    firstName: string;
    lastName: string;
  };
}

interface EditAppointmentModalProps {
  visible: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({ 
  visible, 
  appointment, 
  onClose, 
  onSuccess 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Load staff list when modal opens
  useEffect(() => {
    if (visible) {
      const fetchStaff = async () => {
        try {
          const response = await apiClient.get('/admin/users');
          setStaffList(response.data.filter((user: any) => user.role !== 'client'));
        } catch (error) {
          message.error('No se pudieron cargar los datos del personal.');
        }
      };
      fetchStaff();
    }
  }, [visible]);

  // Populate form when appointment data is available
  useEffect(() => {
    if (visible && appointment) {
      form.setFieldsValue({
        title: appointment.title,
        staffId: appointment.staffId,
        startTime: dayjs(appointment.startTime),
        endTime: dayjs(appointment.endTime),
        status: appointment.status,
      });
    }
  }, [visible, appointment, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      message.loading({ content: 'Actualizando...', key: 'editAppt' });

      const payload = {
        title: values.title,
        staffId: values.staffId,
        startTime: values.startTime.toISOString(),
        endTime: values.endTime.toISOString(),
        status: values.status,
      };

      await apiClient.patch(`/admin/appointments/${appointment?.id}`, payload);
      
      message.success({ content: '¡Cita actualizada exitosamente!', key: 'editAppt' });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Appointment update error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Ocurrió un error al actualizar la cita.';
      message.error({ content: errorMessage, key: 'editAppt' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  if (!appointment) return null;

  return (
    <Modal
      title="Editar Cita"
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={
        <div className="flex justify-end space-x-2">
          <Button onClick={handleCancel}>Cancelar</Button>
          <Button type="primary" loading={loading} onClick={handleOk}>
            ✅ Actualizar Cita
          </Button>
        </div>
      }
    >
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Información de la Cita</h4>
        <div className="text-sm text-gray-600">
          <p><strong>Cliente:</strong> {appointment.case?.client?.firstName} {appointment.case?.client?.lastName}</p>
          <p><strong>Caso:</strong> {appointment.case?.title}</p>
          <p><strong>Asignado a:</strong> {appointment.staff?.firstName} {appointment.staff?.lastName}</p>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item 
          name="title" 
          label="Título de la Cita" 
          rules={[{ required: true, message: "Debe ingresar un título para la cita" }]}
        >
          <Input placeholder="Ej: Consulta inicial, Seguimiento, etc." />
        </Form.Item>

        <Form.Item 
          name="staffId" 
          label="Reasignar a" 
          rules={[{ required: true, message: "Debe seleccionar un miembro del personal" }]}
        >
          <Select 
            placeholder="Seleccione un miembro del personal"
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {staffList.map(s => (
              <Option key={s.id} value={s.id}>
                {`${s.firstName} ${s.lastName} (${s.role})`}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item 
          name="startTime" 
          label="Fecha y Hora de Inicio" 
          rules={[{ required: true, message: "Debe seleccionar la fecha y hora de inicio" }]}
        >
          <DatePicker 
            showTime={{ format: 'HH:mm' }} 
            format="DD/MM/YYYY HH:mm" 
            style={{ width: '100%' }}
            placeholder="Seleccione fecha y hora"
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        </Form.Item>

        <Form.Item 
          name="endTime" 
          label="Fecha y Hora de Fin" 
          rules={[{ required: true, message: "Debe seleccionar la fecha y hora de fin" }]}
        >
          <DatePicker 
            showTime={{ format: 'HH:mm' }} 
            format="DD/MM/YYYY HH:mm" 
            style={{ width: '100%' }}
            placeholder="Seleccione fecha y hora"
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        </Form.Item>

        <Form.Item 
          name="status" 
          label="Estado" 
          rules={[{ required: true }]}
        >
          <Select>
            <Option value="confirmed">✅ Confirmada</Option>
            <Option value="pending">⏳ Pendiente</Option>
            <Option value="completed">✅ Completada</Option>
            <Option value="cancelled">❌ Cancelada</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditAppointmentModal; 