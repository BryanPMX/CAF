'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, Space, Typography, Spin, Alert, Tabs } from 'antd';
import { 
  UserOutlined, 
  FileTextOutlined, 
  CalendarOutlined, 
  BankOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  BarChartOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../lib/api';
import { DashboardSummary, User, Case, Appointment, Office } from '../../lib/types';
import { handleApiError, logApiSuccess } from '../../lib/logger';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AdminDashboard: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    setUserRole(role);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard summary
      const summaryRes = await apiClient.get('/dashboard-summary');
      setSummary(summaryRes.data);

      // Fetch recent users (only for admin and office managers)
      try {
        const usersRes = await apiClient.get('/users');
        setRecentUsers(usersRes.data.slice(0, 5));
      } catch (error) {
        console.warn('Could not fetch users:', error);
        setRecentUsers([]);
      }

      // Fetch recent cases
      try {
        const casesRes = await apiClient.get('/cases');
        setRecentCases(casesRes.data.slice(0, 5));
      } catch (error) {
        console.warn('Could not fetch cases:', error);
        setRecentCases([]);
      }

      // Fetch recent appointments
      try {
        const appointmentsRes = await apiClient.get('/appointments');
        setRecentAppointments(appointmentsRes.data.slice(0, 5));
      } catch (error) {
        console.warn('Could not fetch appointments:', error);
        setRecentAppointments([]);
      }

      // Fetch unread notifications count
      try {
        const notificationsRes = await apiClient.get('/notifications/unread-count');
        setUnreadNotifications(notificationsRes.data.count || 0);
      } catch (error) {
        // Notifications endpoint might not exist yet, set to 0
        setUnreadNotifications(0);
      }

      logApiSuccess('Admin dashboard data loaded successfully', 'AdminDashboard');
    } catch (error) {
      const errorMessage = handleApiError(error, 'AdminDashboard');
      console.error('Dashboard error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  const userColumns = [
    {
      title: 'Nombre',
      dataIndex: 'firstName',
      key: 'firstName',
      render: (text: string, record: User) => `${record.firstName} ${record.lastName}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleLabels: { [key: string]: string } = {
          admin: 'Administrador',
          office_manager: 'Gerente de Oficina',
          staff: 'Personal',
          counselor: 'Consejero',
          psychologist: 'Psicólogo',
          client: 'Cliente'
        };
        return roleLabels[role] || role;
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (text: string, record: User) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => navigateTo(`/app/users/${record.id}`)}
            size="small"
          >
            Ver
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => navigateTo(`/app/users/${record.id}/edit`)}
            size="small"
          >
            Editar
          </Button>
        </Space>
      ),
    },
  ];

  const caseColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Cliente',
      dataIndex: 'clientName',
      key: 'clientName',
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          open: { color: 'blue', text: 'Abierto' },
          in_progress: { color: 'orange', text: 'En Progreso' },
          completed: { color: 'green', text: 'Completado' },
          closed: { color: 'red', text: 'Cerrado' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status };
        return <span style={{ color: config.color }}>{config.text}</span>;
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (text: string, record: Case) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => navigateTo(`/app/cases/${record.id}`)}
            size="small"
          >
            Ver
          </Button>
        </Space>
      ),
    },
  ];

  const appointmentColumns = [
    {
      title: 'Cliente',
      dataIndex: 'clientName',
      key: 'clientName',
    },
    {
      title: 'Fecha',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (date: string) => new Date(date).toLocaleDateString('es-ES'),
    },
    {
      title: 'Hora',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (date: string) => new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          scheduled: { color: 'blue', text: 'Programada' },
          confirmed: { color: 'green', text: 'Confirmada' },
          completed: { color: 'green', text: 'Completada' },
          cancelled: { color: 'red', text: 'Cancelada' },
          no_show: { color: 'orange', text: 'No Presentó' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status };
        return <span style={{ color: config.color }}>{config.text}</span>;
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (text: string, record: Appointment) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => navigateTo(`/app/appointments/${record.id}`)}
            size="small"
          >
            Ver
          </Button>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="Cargando dashboard administrativo..." />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <Title level={2} className="mb-2">
              Dashboard Administrativo
            </Title>
            <Text type="secondary">
              Bienvenido al panel de administración del sistema CAF
            </Text>
          </div>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
              loading={loading}
            >
              Actualizar
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => navigateTo('/app/appointments')}
            >
              Nueva Cita
            </Button>
          </Space>
        </div>

        {/* Role-based access notice */}
        {userRole && (
          <Alert
            message={`Acceso como: ${userRole === 'admin' ? 'Administrador' : 'Gerente de Oficina'}`}
            description="Tienes acceso completo a todas las funciones administrativas del sistema."
            type="info"
            showIcon
            className="mb-4"
          />
        )}
      </div>

      {/* Statistics Cards */}
      <Row gutter={[24, 24]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic 
              title="Citas para Hoy" 
              value={summary?.appointmentsToday || 0} 
              prefix={<CalendarOutlined />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic 
              title="Casos Abiertos" 
              value={summary?.totalOpenCases || 0} 
              prefix={<FileTextOutlined />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic 
              title="Personal Activo" 
              value={summary?.totalStaff || 0} 
              prefix={<TeamOutlined />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic 
              title="Notificaciones" 
              value={unreadNotifications} 
              prefix={<CheckCircleOutlined />} 
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs for different sections */}
      <Tabs defaultActiveKey="overview" className="mb-6">
        <TabPane tab="Resumen General" key="overview">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card title="Usuarios Recientes" extra={<Button type="link" onClick={() => navigateTo('/app/users')}>Ver Todos</Button>}>
                <Table 
                  dataSource={recentUsers} 
                  columns={userColumns} 
                  pagination={false}
                  size="small"
                  rowKey="id"
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Casos Recientes" extra={<Button type="link" onClick={() => navigateTo('/app/cases')}>Ver Todos</Button>}>
                <Table 
                  dataSource={recentCases} 
                  columns={caseColumns} 
                  pagination={false}
                  size="small"
                  rowKey="id"
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
        
        <TabPane tab="Citas" key="appointments">
          <Card title="Citas Recientes" extra={<Button type="link" onClick={() => navigateTo('/app/appointments')}>Ver Todas</Button>}>
            <Table 
              dataSource={recentAppointments} 
              columns={appointmentColumns} 
              pagination={false}
              size="small"
              rowKey="id"
            />
          </Card>
        </TabPane>
        
        <TabPane tab="Reportes" key="reports">
          <Card title="Reportes Disponibles">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Card size="small" hoverable onClick={() => navigateTo('/app/reports')}>
                  <Statistic title="Reporte de Casos" value="Ver" prefix={<BarChartOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Card size="small" hoverable onClick={() => navigateTo('/app/reports')}>
                  <Statistic title="Reporte de Citas" value="Ver" prefix={<CalendarOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Card size="small" hoverable onClick={() => navigateTo('/app/records')}>
                  <Statistic title="Archivos" value="Ver" prefix={<FileTextOutlined />} />
                </Card>
              </Col>
            </Row>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
