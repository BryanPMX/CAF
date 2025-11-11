'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, TimePicker, Button, message, Space, Alert, Tag, Divider } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, CheckCircleOutlined, CalendarOutlined, UserOutlined } from '@ant-design/icons';
import Cookies from 'js-cookie';
import { apiClient } from '@/app/lib/api';
import { Appointment, User } from '@/app/lib/types';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

// Extended appointment interface with preloaded relationships
interface AppointmentWithDetails extends Appointment {
  case?: {
    title: string;
    category?: string;
    client?: {
      id: number;
      firstName: string;
      lastName: string;
    };
  };
  staff?: {
    firstName: string;
    lastName: string;
  };
}

interface EditAppointmentModalProps {
  visible: boolean;
  appointment: AppointmentWithDetails | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface EditAppointmentFormData {
  title: string;
  date: string;
  time: string;
  status: string;
  staffId: number;
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
  const [completingAppointment, setCompletingAppointment] = useState(false);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [currentDuration, setCurrentDuration] = useState<number>(60); // Default 60 minutes

  useEffect(() => {
    if (visible) {
      fetchSupportingData();
      if (appointment) {
        // Calculate current duration from appointment data
        let duration = 60; // Default fallback duration
        try {
          const startTime = dayjs(appointment.startTime);
          const endTime = dayjs(appointment.endTime);

          if (startTime.isValid() && endTime.isValid() && endTime.isAfter(startTime)) {
            duration = endTime.diff(startTime, 'minutes');
          }
        } catch (error) {
          console.warn('Error calculating appointment duration, using default:', error);
        }

        setCurrentDuration(Math.max(duration, 15)); // Minimum 15 minutes

        // Convert startTime to separate date and time for the form
        const startTime = dayjs(appointment.startTime);
        form.setFieldsValue({
          title: appointment.title,
          date: startTime, // Pre-populate with current date
          time: startTime, // Pre-populate with current time
          status: appointment.status,
          staffId: appointment.staffId,
          caseId: appointment.caseId,
          notes: '' // Notes field doesn't exist in new interface
        });
      }
    }
  }, [visible, appointment, form]);

  const fetchSupportingData = async () => {
    try {
      const role = typeof window !== 'undefined' ? Cookies.get('userRole') : 'admin';

      // For editing appointments, we only need staff list for reassignment
      // Try to get staff list, but don't fail if we can't access it
      try {
        let staffEndpoint: string;
        if (role === 'admin') {
          staffEndpoint = '/admin/users';
        } else if (role === 'office_manager') {
          staffEndpoint = '/manager/users';
        } else {
          staffEndpoint = '/users'; // fallback for other roles
        }

        const staffRes = await apiClient.get(staffEndpoint);
        const staffPayload = Array.isArray(staffRes.data) ? staffRes.data : (staffRes.data?.users || []);
        setStaffList(staffPayload.filter((user: User) => user.role !== 'client'));
      } catch (staffError) {
        console.warn('Could not load staff list:', staffError);
        // Set empty staff list - user can still edit title/notes but not reassign
        setStaffList([]);
      }

      // We don't need clients list for editing existing appointments
      setClients([]);

    } catch (error: any) {
      console.error('EditAppointmentModal fetchSupportingData error:', error);
      // Don't show error message for supporting data - appointment editing should still work
    }
  };

  const handleSubmit = async (values: any) => {
    if (!appointment) return;

    setLoading(true);
    try {
      const updateData: any = {
        title: values.title,
        notes: values.notes
      };

      // Include startTime and endTime for non-completed appointments
      if (appointment.status !== 'completed') {
        if (values.date && values.time) {
          // Combine the selected date and time
          const selectedDate = dayjs(values.date);
          const selectedTime = dayjs(values.time);

          if (!selectedDate.isValid() || !selectedTime.isValid()) {
            message.error('Fecha u hora inválida.');
            setLoading(false);
            return;
          }

          const newStartTime = selectedDate
            .hour(selectedTime.hour())
            .minute(selectedTime.minute())
            .second(0)
            .millisecond(0);

          // Only allow future appointments
          if (newStartTime.isAfter(dayjs())) {
            // Calculate new end time maintaining the same duration
            const newEndTime = newStartTime.add(currentDuration, 'minutes');

            updateData.startTime = newStartTime.toISOString();
            updateData.endTime = newEndTime.toISOString();
          } else {
            message.warning('La nueva fecha y hora debe ser en el futuro.');
            setLoading(false);
            return;
          }
        } else {
          message.error('Debe seleccionar tanto la fecha como la hora.');
          setLoading(false);
          return;
        }
      }

      // Only include status if appointment is not completed
      if (values.status && appointment.status !== 'completed') {
        updateData.status = values.status;
      }

      // Use appropriate endpoint based on user role
      const role = typeof window !== 'undefined' ? Cookies.get('userRole') : 'admin';
      let endpoint: string;
      if (role === 'admin') {
        endpoint = `/admin/appointments/${appointment.id}`;
      } else if (role === 'office_manager') {
        endpoint = `/manager/appointments/${appointment.id}`;
      } else {
        endpoint = `/appointments/${appointment.id}`;
      }
      await apiClient.patch(endpoint, updateData);
      
      message.success('Cita actualizada exitosamente.');
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

  // Get client name for display - use the preloaded case client data
  const getClientName = (appointment: AppointmentWithDetails | null) => {
    if (!appointment) return 'Cliente no disponible';

    // Check if the appointment has preloaded case and client data
    if (appointment.case?.client) {
      const client = appointment.case.client;
      return `${client.firstName} ${client.lastName}`;
    }

    // Fallback to placeholder if client data is not available
    return 'Cliente no disponible';
  };

  // Get staff name for display - use the preloaded staff data
  const getStaffName = (appointment: AppointmentWithDetails | null) => {
    if (!appointment) return 'Personal no asignado';

    // Check if the appointment has preloaded staff data
    if (appointment.staff) {
      const staff = appointment.staff;
      return `${staff.firstName} ${staff.lastName}`;
    }

    // Fallback: try to find staff from the staffList (for backward compatibility)
    const staff = staffList.find(s => s.id === appointment.staffId);
    return staff ? `${staff.firstName} ${staff.lastName}` : 'Personal no encontrado';
  };

  // Handle appointment completion
  const handleCompleteAppointment = async () => {
    if (!appointment) return;
    
    setCompletingAppointment(true);
    try {
      // Use appropriate endpoint based on user role
      const role = typeof window !== 'undefined' ? Cookies.get('userRole') : 'admin';
      let endpoint: string;
      if (role === 'admin') {
        endpoint = `/admin/appointments/${appointment.id}`;
      } else if (role === 'office_manager') {
        endpoint = `/manager/appointments/${appointment.id}`;
      } else {
        endpoint = `/appointments/${appointment.id}`;
      }
      await apiClient.patch(endpoint, {
        status: 'completed'
      });
      
      message.success('Cita marcada como completada exitosamente.');
      onSuccess();
      onCancel();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Error al completar la cita';
      message.error(`Error al completar la cita: ${errorMessage}`);
    } finally {
      setCompletingAppointment(false);
    }
  };

  // Check if appointment can be completed
  const canCompleteAppointment = () => {
    if (!appointment) return false;
    const now = dayjs();
    const appointmentTime = dayjs(appointment.startTime);
    return appointment.status !== 'completed' && 
           appointment.status !== 'cancelled' && 
           appointmentTime.isBefore(now.add(1, 'hour')); // Can complete 1 hour before or after appointment time
  };

  // Get the fixed duration for this appointment
  const getCurrentDuration = () => {
    return currentDuration;
  };

  // Get status styling
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'confirmed': return 'processing';
      case 'cancelled': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completada';
      case 'confirmed': return 'Confirmada';
      case 'cancelled': return 'Cancelada';
      case 'pending': return 'Pendiente';
      default: return status;
    }
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
        <>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-medium text-blue-900 flex items-center">
                <CalendarOutlined className="mr-2" />
                Información de la Cita
              </h4>
              <Tag color={getStatusColor(appointment.status)} className="text-sm">
                {getStatusText(appointment.status)}
              </Tag>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Cliente:</span>
                <div className="flex items-center mt-1">
                  <UserOutlined className="mr-1 text-gray-500" />
                  {getClientName(appointment)}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Personal Asignado:</span>
                <div className="flex items-center mt-1">
                  <UserOutlined className="mr-1 text-gray-500" />
                  {getStaffName(appointment)}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Fecha y Hora:</span>
                <div className="mt-1">{dayjs(appointment.startTime).format('DD/MM/YYYY HH:mm')}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Duración:</span>
                <div className="mt-1">{getCurrentDuration()} minutos</div>
              </div>
            </div>
          </div>

          {appointment.status === 'completed' && (
            <Alert
              message="Esta cita ya ha sido completada"
              description="Solo puede editar el título y las notas de citas completadas."
              type="success"
              showIcon
              className="mb-4"
            />
          )}

          {canCompleteAppointment() && (
            <Alert
              message="¿Cita finalizada?"
              description="Si la cita ya se realizó, puede marcarla como completada."
              type="info"
              showIcon
              action={
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={completingAppointment}
                  onClick={handleCompleteAppointment}
                >
                  Marcar como Completada
                </Button>
              }
              className="mb-4"
            />
          )}

          <Divider />
        </>
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
          label="Título de la Cita"
          rules={[{ required: true, message: 'Por favor ingrese el título' }]}
          tooltip="Puede modificar el título para reflejar mejor el propósito de la cita"
        >
          <Input placeholder="Ej: Consulta inicial, Seguimiento, Revisión de documentos" />
        </Form.Item>

        {/* Allow date/time editing for all non-completed appointments */}
        {appointment && appointment.status !== 'completed' && (
          <>
            <Form.Item
              name="date"
              label="Fecha de la Cita"
              rules={[{ required: true, message: 'Por favor seleccione la fecha' }]}
              tooltip="Seleccione la nueva fecha de la cita"
            >
              <DatePicker
                style={{ width: '100%' }}
                placeholder="Seleccionar fecha"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
                format="DD/MM/YYYY"
              />
            </Form.Item>

            <Form.Item
              name="time"
              label="Hora de la Cita"
              rules={[{ required: true, message: 'Por favor seleccione la hora' }]}
              tooltip="Seleccione la nueva hora de la cita"
            >
              <TimePicker
                style={{ width: '100%' }}
                placeholder="Seleccionar hora"
                format="HH:mm"
                minuteStep={15} // 15-minute intervals
              />
            </Form.Item>
          </>
        )}

        {/* Only show status change for non-completed appointments */}
        {appointment && appointment.status !== 'completed' && (
          <Form.Item
            name="status"
            label="Estado de la Cita"
            tooltip="Cambie el estado según sea necesario"
          >
            <Select placeholder="Seleccionar estado">
              <Option value="confirmed">✅ Confirmada</Option>
              <Option value="pending">⏳ Pendiente</Option>
              <Option value="cancelled">❌ Cancelada</Option>
            </Select>
          </Form.Item>
        )}


        {/* Notes section - always editable for additional information */}
        <Divider orientation="left">Notas y Observaciones</Divider>

        <Form.Item
          name="notes"
          label="Notas y Observaciones"
          tooltip="Agregue cualquier información adicional sobre la cita, resultados, o seguimiento necesario"
        >
          <TextArea 
            rows={4} 
            placeholder="Ej: Cliente llegó puntual, se revisaron documentos X e Y, próximos pasos: ..."
            showCount
            maxLength={500}
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