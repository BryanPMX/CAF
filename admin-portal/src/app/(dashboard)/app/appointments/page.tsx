// admin-portal/src/app/(dashboard)/app/appointments/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Table, Tag, message, Spin, Button, Popconfirm, Card, Statistic, Row, Col, Select, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { AppointmentService } from '@/services/appointmentService';
import { UserService } from '@/services/userService';
import { Appointment as AppointmentType } from '@/app/lib/types';
import { useAuth } from '@/context/AuthContext';
import { APPOINTMENT_STATUS_CONFIG, getValidAppointmentStatuses } from '@/config/statuses';
import AppointmentModal from '../../components/AppointmentModal';
import EditAppointmentModal from '../../components/EditAppointmentModal';
import SmartSearchBar from '../../components/SmartSearchBar';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

// Local appointment interface with additional properties
interface Appointment extends AppointmentType {
  case?: {
    title: string;
    category?: string;
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
  const isHydrated = useHydrationSafe();
  const { user } = useAuth();
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
    // User role is guaranteed to be available by the parent layout
    if (user) {
      setUserRole(user.role);
    }
  }, [user]);

  const fetchAppointments = async (forceRefresh: boolean = false, showLoading: boolean = true) => {
    try {
      // Check if user is loaded
      if (!user) {
        console.warn('Cannot fetch appointments: user not loaded');
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      // Use centralized service layer with role-based endpoint routing
      const data = await AppointmentService.fetchAppointments(
        user.role,
        {
          page: 1,
          pageSize: 1000, // Get all appointments for now
          // Add cache-busting timestamp if force refresh
          ...(forceRefresh ? { _t: Date.now() } : {})
        }
      );

      // Appointments loaded successfully
      setAppointments(data.data);
      setFilteredAppointments(data.data);
    } catch (error: any) {
      console.error('Failed to fetch appointments:', error);
      // Only show error messages for manual operations, not auto-refresh
      if (showLoading) {
        const errorMessage = error.response?.data?.error || error.message || 'No se pudieron cargar las citas.';
        message.error(`Error: ${errorMessage}`);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchSupportingData = async () => {
    try {
      // Wait for user to be loaded before fetching
      // User role is guaranteed to be available by the parent layout
      // No need to check for user?.role since the dashboard layout ensures it exists

      // User role is guaranteed to be available by the parent layout
      const role = user!.role;
      
      // Only fetch users if user has permission
      if (role === 'admin' || role === 'office_manager') {
        const [staffData, clientsData] = await Promise.all([
          UserService.fetchUsers(role, { page: 1, pageSize: 1000 }),
          UserService.fetchUsers(role, { page: 1, pageSize: 1000, filters: { role: 'client' } })
        ]);

        setStaffList(staffData.data.filter((user: any) => user.role !== 'client'));
        setClientList(clientsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch supporting data:', error);
    }
  };

  // Fetch the data when the component first loads or when user changes.
  useEffect(() => {
    fetchAppointments();
    fetchSupportingData();
  }, [user]);

  // Auto-refresh appointments every 30 seconds (completely silent, with cache busting)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchAppointments(true, false).catch(error => {
        console.error('Auto-refresh: Failed to fetch appointments:', error);
      }); // Silent refresh with cache busting, no loading, no errors
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user]);

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
    
    // Apply category filter (using case category instead)
    if (filters.category) {
      filtered = filtered.filter(appointment => appointment.case?.category === filters.category);
    }
    
    // Apply date range filter
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter(appointment => {
        const appointmentDate = dayjs(appointment.startTime);
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
      // Wait for user to be loaded before deleting
      // User role is guaranteed to be available by the parent layout
      if (!user) {
        message.error('Usuario no autenticado');
        return;
      }

      message.loading({ content: 'Eliminando...', key: 'deleteAppt' });
      await AppointmentService.deleteAppointment(user!.role, appointmentId.toString());
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
        const config = APPOINTMENT_STATUS_CONFIG[status as keyof typeof APPOINTMENT_STATUS_CONFIG];
        if (config) {
          return <Tag color={config.color}>{config.label}</Tag>;
        }
        return <Tag color="default">{status}</Tag>;
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

  // Calculate statistics using centralized status configuration
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
        <div className="flex gap-2">
          {/* IMPROVEMENT: Button is only shown to authorized roles and is disabled during loading */}
          {canManageAppointments && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} disabled={loading}>
              Programar Cita
            </Button>
          )}
        </div>
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
          scroll={{ x: true }}
          locale={{ emptyText: 'No hay citas programadas.' }}
        />
      </Spin>

      {/* Modals */}
      <AppointmentModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={() => fetchAppointments(true)}
      />
      
      <EditAppointmentModal
        visible={isEditModalVisible}
        appointment={editingAppointment}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingAppointment(null);
        }}
        onSuccess={() => fetchAppointments(true)}
      />
    </div>
  );
};

export default AppointmentsPage;



