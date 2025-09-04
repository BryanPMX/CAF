// admin-portal/src/app/(dashboard)/app/appointments/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Table, Tag, message, Spin, Button, Popconfirm, Card, Statistic, Row, Col, Select, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { Appointment as AppointmentType } from '@/app/lib/types';
import AppointmentModal from '../../components/AppointmentModal';
import EditAppointmentModal from '../../components/EditAppointmentModal';
import SmartSearchBar from '../../components/SmartSearchBar';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

// Local appointment interface with additional properties
interface Appointment extends AppointmentType {
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
  const [deptFilter, setDeptFilter] = useState<string | undefined>(undefined);
  const [caseTypeFilter, setCaseTypeFilter] = useState<string | undefined>(undefined);
  const [searchFilters, setSearchFilters] = useState<any>({});

  // --- Data Fetching & Role Management ---
  useEffect(() => {
    // Get the user's role from localStorage to control UI elements
    const role = localStorage.getItem('userRole');
    setUserRole(role);
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      // Base list is protected route for any logged-in user; scoped by backend
      const response = await apiClient.get('/appointments');
      // Appointments loaded successfully
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
      const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'admin';
      const base = role === 'office_manager' ? '/manager' : '/admin';
      const [staffRes, clientsRes] = await Promise.all([
        apiClient.get(`${base}/users`),
        apiClient.get(`${base}/users?role=client`)
      ]);

      const staffPayload = Array.isArray(staffRes.data)
        ? staffRes.data
        : (staffRes.data?.users || []);
      const clientsPayload = Array.isArray(clientsRes.data)
        ? clientsRes.data
        : (clientsRes.data?.users || []);

      setStaffList(staffPayload.filter((user: any) => user.role !== 'client'));
      setClientList(clientsPayload);
    } catch (error) {
      console.error('Failed to fetch supporting data:', error);
    }
  };

  // Fetch the data when the component first loads.
  useEffect(() => {
    fetchAppointments();
    fetchSupportingData();
  }, []);

  // Department and Case Type options
  const DEPARTMENTS = ['Familiar', 'Civil', 'Psicologia', 'Recursos'];
  const CASE_TYPES = [
    'Divorcios','Guardia y Custodia','Acto Prejudicial','Adopcion','Pension Alimenticia','Rectificacion de Actas','Reclamacion de Paternidad',
    'Prescripcion Positiva','Reinvindicatorio','Intestado',
    'Individual','Pareja',
    'Tutoria Escolar','Asistencia Social',
    'Otro'
  ];

  const mapCaseTypeToDepartment = (caseType: string): string | undefined => {
    if (['Divorcios','Guardia y Custodia','Acto Prejudicial','Adopcion','Pension Alimenticia','Rectificacion de Actas','Reclamacion de Paternidad'].includes(caseType)) return 'Familiar';
    if (['Prescripcion Positiva','Reinvindicatorio','Intestado'].includes(caseType)) return 'Civil';
    if (['Individual','Pareja'].includes(caseType)) return 'Psicologia';
    if (['Tutoria Escolar','Asistencia Social'].includes(caseType)) return 'Recursos';
    return undefined;
  };

  // --- Event Handlers ---
  const handleCreate = () => {
    setEditingAppointment(null);
    setIsModalVisible(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsEditModalVisible(true);
  };

  // --- Search & Filter Functions ---
  const handleSearch = (query: string) => {
    setSearchLoading(true);
    
    const filtered = appointments.filter(appointment => {
      const searchLower = query.toLowerCase();
      const titleMatch = appointment.title.toLowerCase().includes(searchLower);
      const caseMatch = appointment.case?.title.toLowerCase().includes(searchLower);
      const staffMatch = `${appointment.staff?.firstName} ${appointment.staff?.lastName}`.toLowerCase().includes(searchLower);
      
      return titleMatch || caseMatch || staffMatch;
    });
    
    setFilteredAppointments(filtered);
    setSearchLoading(false);
  };

  const handleFiltersChange = (filters: any) => {
    setSearchFilters(filters);
    setSearchLoading(true);
    
    let filtered = appointments;
    
    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(appointment => appointment.status === filters.status);
    }
    
    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(appointment => appointment.category === filters.category);
    }
    
    // Apply date range filter
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter(appointment => {
        const appointmentDate = dayjs(appointment.date);
        return appointmentDate.isBetween(startDate, endDate, 'day', '[]');
      });
    }
    
    setFilteredAppointments(filtered);
    setSearchLoading(false);
  };

  const handleClearSearch = () => {
    setSearchFilters({});
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
          : 'Cliente eliminado',
    },
    {
      title: 'Asunto',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Departamento',
      key: 'department',
      render: (_: any, record: Appointment) => record.case?.title ? mapCaseTypeToDepartment(record.case.title) : 'N/A',
    },
    {
      title: 'Tipo de Caso',
      key: 'caseType',
      render: (_: any, record: Appointment) => record.case?.title || record.title || 'N/A',
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
        const MAP: Record<string, { label: string; color: string }> = {
          confirmed: { label: 'Confirmada', color: 'green' }, // Green for Confirmado
          pending: { label: 'Pendiente', color: 'gold' },     // Yellow for Pending
          completed: { label: 'Completada', color: 'red' },   // Treat as closed outcome per request
          cancelled: { label: 'Cancelada', color: 'red' },
        };
        const { label, color } = MAP[status] || { label: status, color: 'default' };
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Appointment) => (
        <span className="space-x-2">
          {/* IMPROVEMENT: Accessibility and role-based UI */}
          <Button aria-label="Editar Cita" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          {/* Admin and Office Manager can delete appointments */}
          {(userRole === 'admin' || userRole === 'office_manager') && (
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
  const canManageAppointments = userRole === 'admin' || userRole === 'office_manager';

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

      {/* Department / Case Type Filters */}
      <div className="mb-4">
        <Space size="middle" wrap>
          <Select
            allowClear
            placeholder="Filtrar por Departamento"
            style={{ minWidth: 220 }}
            value={deptFilter}
            onChange={(v) => { setDeptFilter(v); handleFiltersChange({}); }}
            options={DEPARTMENTS.map(d => ({ label: d, value: d }))}
          />
          <Select
            allowClear
            showSearch
            placeholder="Filtrar por Tipo de Caso"
            style={{ minWidth: 260 }}
            value={caseTypeFilter}
            onChange={(v) => { setCaseTypeFilter(v); handleFiltersChange({}); }}
            options={CASE_TYPES.map(ct => ({ label: ct, value: ct }))}
          />
        </Space>
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
        onFiltersChange={handleFiltersChange}
        placeholder="Buscar citas por título, caso o personal..."
        showFilters={true}
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
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingAppointment(null);
        }}
        onSuccess={fetchAppointments}
      />
    </div>
  );
};

export default AppointmentsPage;



