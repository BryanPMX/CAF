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
import { APPOINTMENT_STATUS_OPTIONS } from '@/config/statuses';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import { useWebSocket } from '@/hooks/useWebSocket';
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
  const { isConnected: wsConnected, lastMessage } = useWebSocket();
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
  const [searchFilters, setSearchFilters] = useState<any>({});

  // --- Data Fetching & Role Management ---
  useEffect(() => {
    // User role is guaranteed to be available by the parent layout
    if (user) {
      setUserRole(user.role);
    }
  }, [user]);


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
    console.log('User changed, refetching appointments for user:', user?.role, user?.id);
    // Clear any cached data and force fresh data when user changes (account switching)
    setAppointments([]);
    setFilteredAppointments([]);
    // Fetch fresh data without filters when user changes
    fetchAppointmentsWithFilters({});
    fetchSupportingData();
  }, [user]);

  // Handle real-time WebSocket updates for appointments
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'notification' && lastMessage.notification?.type === 'appointment_updated') {
      console.log('Appointment update received via WebSocket:', lastMessage.notification);

      // Immediately refresh appointments with current filters when an update is received
      fetchAppointmentsWithFilters(searchFilters, false).catch(error => {
        console.error('WebSocket-triggered refresh: Failed to fetch appointments:', error);
      });
    }
  }, [lastMessage]); // Only depend on lastMessage, not searchFilters

  // Auto-refresh appointments every 30 seconds (completely silent, with current filters)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      console.log('Auto-refresh: Refetching with current filters:', searchFilters);
      fetchAppointmentsWithFilters(searchFilters, false).catch(error => {
        console.error('Auto-refresh: Failed to fetch appointments:', error);
      }); // Silent refresh with current filters, no loading, no errors
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user, searchFilters]);

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
    console.log('handleFiltersChange called with filters:', filters);
    setSearchFilters(filters);
    // Refetch data from backend with filters instead of client-side filtering
    fetchAppointmentsWithFilters(filters);
  };

  const fetchAppointmentsWithFilters = async (filters: any, showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setSearchLoading(true);
      }

      // Check if user is loaded
      if (!user) {
        console.warn('Cannot fetch appointments: user not loaded');
        return;
      }

      const params = {
        page: 1,
        pageSize: 1000, // Get all appointments for now
        // Include filter parameters for backend filtering
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
        ...(filters.department && { department: filters.department }),
        ...(filters.dateRange && filters.dateRange.length === 2 && {
          dateFrom: filters.dateRange[0].format('YYYY-MM-DD'),
          dateTo: filters.dateRange[1].format('YYYY-MM-DD')
        })
      };

      console.log('fetchAppointmentsWithFilters called with params:', params);

      // Use centralized service layer with role-based endpoint routing
      const data = await AppointmentService.fetchAppointments(user.role, params);

      // Set filtered results directly (no additional client-side filtering needed)
      setFilteredAppointments(data.data);
    } catch (error: any) {
      console.error('Failed to fetch filtered appointments:', error);
      // Only show error messages for manual operations
      const errorMessage = error.response?.data?.error || error.message || 'No se pudieron cargar las citas filtradas.';
      message.error(`Error: ${errorMessage}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    console.log('handleClearSearch called - clearing filters and refetching all data');
    setSearchFilters({});
    // Refetch all data without filters
    fetchAppointmentsWithFilters({});
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
      fetchAppointmentsWithFilters(searchFilters); // Refresh the list with current filters
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
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Gestión de Citas</h1>
          {/* Real-time connection indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
              title={wsConnected ? 'Conectado en tiempo real' : 'Sin conexión en tiempo real'}
            />
            <span className="text-xs text-gray-500">
              {wsConnected ? 'En vivo' : 'Sin conexión'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {/* IMPROVEMENT: Button is only shown to authorized roles and is disabled during loading */}
          {canManageAppointments && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} disabled={loading}>
              Programar Cita
            </Button>
          )}
        </div>
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
        appointmentStatuses={APPOINTMENT_STATUS_OPTIONS}
        appointmentDepartments={DEPARTMENTS}
        caseCategories={CASE_TYPES}
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
        onSuccess={() => fetchAppointmentsWithFilters(searchFilters)}
      />

      <EditAppointmentModal
        visible={isEditModalVisible}
        appointment={editingAppointment}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingAppointment(null);
        }}
        onSuccess={() => fetchAppointmentsWithFilters(searchFilters)}
      />
    </div>
  );
};

export default AppointmentsPage;



