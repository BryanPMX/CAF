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

interface EditAppointmentModalProps {
  visible: boolean;
  appointment: Appointment | null;
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

  useEffect(() => {
    if (visible) {
      fetchSupportingData();
      if (appointment) {
        // Convert startTime to separate date and time for the form
        const startTime = dayjs(appointment.startTime);
        form.setFieldsValue({
          title: appointment.title,
          date: startTime,
          time: startTime,
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

      // Only include startTime if date/time were provided and appointment allows it
      if (values.date && values.time && appointment.status !== 'completed') {
        const newStartTime = dayjs(values.date).hour(dayjs(values.time).hour()).minute(dayjs(values.time).minute());
        if (newStartTime.isAfter(dayjs())) {
          updateData.startTime = newStartTime.toISOString();
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

  // Get client name for display - note: clientId doesn't exist in new interface
  const getClientName = (appointment: Appointment | null) => {
    if (!appointment) return 'Cliente no disponible';
    // Since clientId doesn't exist, we'll show a placeholder
    return 'Cliente asociado al caso';
  };

  // Get staff name for display
  const getStaffName = (appointment: Appointment | null) => {
    if (!appointment) return '';
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
      
      message.success('Cita marcada como completada exitosamente');
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
                <div className="mt-1">{dayjs(appointment.endTime).diff(dayjs(appointment.startTime), 'minutes')} minutos</div>
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

        {/* Only allow date/time editing if appointment is not completed and is in the future */}
        {appointment && appointment.status !== 'completed' && dayjs(appointment.startTime).isAfter(dayjs()) && (
          <>
            <Alert
              message="Reprogramar Cita"
              description="Solo puede cambiar la fecha y hora de citas futuras no completadas."
              type="warning"
              showIcon
              className="mb-4"
            />
            
            <Form.Item
              name="date"
              label="Nueva Fecha (Opcional)"
              tooltip="Deje vacío si no desea cambiar la fecha"
            >
              <DatePicker 
                style={{ width: '100%' }} 
                placeholder="Seleccionar nueva fecha"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>

            <Form.Item
              name="time"
              label="Nueva Hora (Opcional)"
              tooltip="Deje vacío si no desea cambiar la hora"
            >
              <TimePicker 
                style={{ width: '100%' }} 
                placeholder="Seleccionar nueva hora"
                format="HH:mm"
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