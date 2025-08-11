// admin-portal/src/app/(dashboard)/app/appointments/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Table, Tag, message, Spin, Button, Popconfirm, Card, Statistic, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { apiClient } from '../../../lib/api';
import AppointmentModal from '../../components/AppointmentModal';
import EditAppointmentModal from '../../components/EditAppointmentModal';
import SmartSearchBar from '../../components/SmartSearchBar';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

// IMPROVEMENT: Nested objects are now optional (?) to prevent runtime errors if the API omits them.
interface Appointment {
  id: number;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  caseId: number;
  staffId: number;
  case?: {
    title: string;
    client?: {
      id: number;
      firstName: string;
      lastName: string;
    }
  };
  staff?: {
    firstName: string;
    lastName: string;
  };
}

const AppointmentsPage = () => {
  // --- State Management ---
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Array<{ id: number; firstName: string; lastName: string; role: string }>>([]);
  const [clientList, setClientList] = useState<Array<{ id: number; firstName: string; lastName: string; email: string }>>([]);

  // --- Data Fetching & Role Management ---
  useEffect(() => {
    // Get the user's role from localStorage to control UI elements
    const role = localStorage.getItem('userRole');
    setUserRole(role);
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/appointments');
      console.log('Appointments response:', response.data);
      setAppointments(response.data);
      setFilteredAppointments(response.data);
    } catch (error: any) {
      console.error('Failed to fetch appointments:', error);
      const errorMessage = error.response?.data?.error || error.message || 'No se pudieron cargar las citas.';
      message.error(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportingData = async () => {
    try {
      const [staffRes, clientsRes] = await Promise.all([
        apiClient.get('/admin/users'),
        apiClient.get('/admin/users?role=client')
      ]);
      
      setStaffList(staffRes.data.filter((user: any) => user.role !== 'client'));
      setClientList(clientsRes.data);
    } catch (error) {
      console.error('Failed to fetch supporting data:', error);
    }
  };

  // Fetch the data when the component first loads.
  useEffect(() => {
    fetchAppointments();
    fetchSupportingData();
  }, []);

  // --- Event Handlers ---
  const handleCreate = () => {
    setEditingAppointment(null);
    setIsModalVisible(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsEditModalVisible(true);
  };

  const handleSearch = (filters: any) => {
    setSearchLoading(true);
    
    // Apply filters to appointments
    let filtered = [...appointments];
    
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(appointment => 
        appointment.title.toLowerCase().includes(searchLower) ||
        appointment.case?.client?.firstName?.toLowerCase().includes(searchLower) ||
        appointment.case?.client?.lastName?.toLowerCase().includes(searchLower) ||
        appointment.case?.title?.toLowerCase().includes(searchLower) ||
        appointment.staff?.firstName?.toLowerCase().includes(searchLower) ||
        appointment.staff?.lastName?.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters.status) {
      filtered = filtered.filter(appointment => appointment.status === filters.status);
    }
    
    if (filters.staffId) {
      filtered = filtered.filter(appointment => appointment.staffId.toString() === filters.staffId);
    }
    
    if (filters.clientId) {
      filtered = filtered.filter(appointment => 
        appointment.case?.client && appointment.case.client.id?.toString() === filters.clientId
      );
    }
    
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const startDate = filters.dateRange[0].startOf('day');
      const endDate = filters.dateRange[1].endOf('day');
      filtered = filtered.filter(appointment => {
        const appointmentDate = dayjs(appointment.startTime);
        return appointmentDate.isBetween(startDate, endDate, 'day', '[]');
      });
    }
    
    setFilteredAppointments(filtered);
    setSearchLoading(false);
  };

  const handleClearSearch = () => {
    setFilteredAppointments(appointments);
  };

  const handleDelete = async (appointmentId: number) => {
    try {
      message.loading({ content: 'Eliminando...', key: 'deleteAppt' });
      await apiClient.delete(`/admin/appointments/${appointmentId}`);
      message.success({ content: 'Cita eliminada exitosamente.', key: 'deleteAppt' });
      fetchAppointments(); // Refresh the list
    } catch (error) {
      message.error({ content: 'No se pudo eliminar la cita.', key: 'deleteAppt' });
    }
  };

  // --- Table Configuration ---
  const columns = [
    {
      title: 'Cliente',
      key: 'client',
      render: (_: any, record: Appointment) =>
        record.case?.client
          ? `${record.case.client.firstName} ${record.case.client.lastName}`
          : 'N/A',
    },
    {
      title: 'Asunto',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Fecha y Hora',
      dataIndex: 'startTime',
      key: 'startTime',
      // IMPROVEMENT: Use dayjs for robust, localized date formatting
      render: (date: string) => dayjs(date).format('DD/MM/YYYY h:mm A'),
    },
     {
      title: 'Asignado a',
      dataIndex: 'staff',
      key: 'staff',
      render: (staff: Appointment['staff']) => staff ? `${staff.firstName} ${staff.lastName}` : 'N/A',
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'geekblue';
        if (status === 'completed') color = 'green';
        if (status === 'cancelled') color = 'volcano';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Appointment) => (
        <span className="space-x-2">
          {/* IMPROVEMENT: Accessibility and role-based UI */}
          <Button aria-label="Editar Cita" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          {/* Only admins can delete appointments */}
          {userRole === 'admin' && (
            <Popconfirm title="¿Está seguro de que desea eliminar esta cita?" onConfirm={() => handleDelete(record.id)}>
              <Button aria-label="Eliminar Cita" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )}
        </span>
      ),
    },
  ];

  // Calculate statistics
  const getStatistics = () => {
    const total = appointments.length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const pending = appointments.filter(a => a.status === 'pending').length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const today = appointments.filter(a => dayjs(a.startTime).isSame(dayjs(), 'day')).length;
    
    return { total, confirmed, pending, completed, today };
  };

  const stats = getStatistics();

  // IMPROVEMENT: Role-based UI check
  const canManageAppointments = userRole === 'admin' || userRole === 'receptionist';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Citas</h1>
        {/* IMPROVEMENT: Button is only shown to authorized roles and is disabled during loading */}
        {canManageAppointments && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} disabled={loading}>
            Programar Cita
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} className="mb-6">
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Citas"
              value={stats.total}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Confirmadas"
              value={stats.confirmed}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Pendientes"
              value={stats.pending}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Completadas"
              value={stats.completed}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Hoy"
              value={stats.today}
              valueStyle={{ color: '#722ed1' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Smart Search Bar */}
      <SmartSearchBar
        onSearch={handleSearch}
        onClear={handleClearSearch}
        staffList={staffList}
        clientList={clientList}
        loading={searchLoading}
      />

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={filteredAppointments}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} citas`,
          }}
        />
      </Spin>

      {/* Modals */}
      <AppointmentModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={fetchAppointments}
      />
      
      <EditAppointmentModal
        visible={isEditModalVisible}
        appointment={editingAppointment}
        onClose={() => {
          setIsEditModalVisible(false);
          setEditingAppointment(null);
        }}
        onSuccess={fetchAppointments}
      />
    </div>
  );
};

export default AppointmentsPage;



