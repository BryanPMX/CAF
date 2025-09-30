// admin-portal/src/app/(dashboard)/page.tsx
'use client';

import React, { useState, useEffect, Suspense, lazy, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Col, 
  Row, 
  Statistic, 
  Spin, 
  message, 
  Button, 
  Space, 
  Progress, 
  Badge, 
  Tooltip, 
  Typography,
  Divider,
  Tag,
  Avatar,
  List,
  Timeline,
  Alert,
  Tabs,
  Empty,
  Skeleton
} from 'antd';
import { 
  ScheduleOutlined, 
  FolderOpenOutlined, 
  TeamOutlined, 
  CheckCircleOutlined, 
  PlusOutlined, 
  BellOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FilterOutlined,
  SearchOutlined,
  HeartOutlined,
  StarOutlined,
  TrophyOutlined,
  FireOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { apiClient } from '../lib/api';
import { Line, Bar, Pie, Area, Column } from '@ant-design/plots';
import { 
  getDashboardWidgetsForRole, 
  PERMISSIONS, 
  STAFF_ROLES,
  type StaffRoleKey,
  isValidRole
} from '@/config/roles';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';

// Lazy load heavy components
const AnnouncementsPanel = lazy(() => import('./components/AnnouncementsPanel'));
const AdminAnnouncementsManager = lazy(() => import('./components/AdminAnnouncementsManager'));
const DashboardCharts = lazy(() => import('./components/DashboardCharts'));
const RealTimeNotifications = lazy(() => import('./components/RealTimeNotifications'));
const DashboardCustomization = lazy(() => import('./components/DashboardCustomization'));

// --- TypeScript Interfaces for Data Structures ---
interface DashboardSummary {
  totalOpenCases?: number;
  totalStaff?: number;
  appointmentsToday?: number;
  // Staff-specific stats
  myOpenCases?: number;
  myPendingTasks?: number;
  myUpcomingAppointments?: number;
  // Enhanced stats
  totalClients?: number;
  completedCases?: number;
  pendingAppointments?: number;
  urgentCases?: number;
  monthlyGrowth?: number;
  weeklyAppointments?: number;
  averageCaseDuration?: number;
  staffPerformance?: number;
}

interface RecentActivity {
  id: string;
  type: 'appointment' | 'case' | 'user' | 'system';
  action: string;
  description: string;
  timestamp: string;
  user: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface QuickStats {
  label: string;
  value: number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
}

// --- Enhanced Dashboard Components ---
const StatCard: React.FC<{ 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  trend?: 'up' | 'down' | 'stable';
  change?: number;
  color?: string;
  suffix?: string;
}> = ({ title, value, icon, trend, change, color = '#1890ff', suffix }) => (
  <Card 
    hoverable 
    className="h-full"
    style={{ 
      background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
      border: `1px solid ${color}20`,
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
    }}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Typography.Text type="secondary" className="text-sm font-medium">
          {title}
        </Typography.Text>
        <div className="mt-2">
          <Typography.Title level={2} className="!mb-1 !text-2xl font-bold" style={{ color }}>
            {value.toLocaleString()}{suffix}
          </Typography.Title>
          {change !== undefined && (
            <div className="flex items-center">
              {trend === 'up' && <RiseOutlined className="text-green-500 mr-1" />}
              {trend === 'down' && <FallOutlined className="text-red-500 mr-1" />}
              {trend === 'stable' && <ClockCircleOutlined className="text-gray-500 mr-1" />}
              <Typography.Text 
                type={trend === 'up' ? 'success' : trend === 'down' ? 'danger' : 'secondary'}
                className="text-xs font-medium"
              >
                {change > 0 ? '+' : ''}{change}%
              </Typography.Text>
            </div>
          )}
        </div>
      </div>
      <div 
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        {React.cloneElement(icon as React.ReactElement, { 
          style: { color, fontSize: '20px' } 
        })}
      </div>
    </div>
  </Card>
);

const RoleBasedDashboard: React.FC<{ 
  data: DashboardSummary; 
  userRole: StaffRoleKey; 
}> = ({ data, userRole }) => {
  // Get widgets for the user's role
  const availableWidgets = getDashboardWidgetsForRole(userRole);
  
  // Define widget components
  const widgetComponents = {
    'system-stats': () => (
      <Card title="Estadísticas del Sistema" className="h-full">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Statistic title="Total de Usuarios" value={data.totalStaff || 0} />
          </Col>
          <Col span={12}>
            <Statistic title="Oficinas Activas" value={3} />
          </Col>
        </Row>
      </Card>
    ),
    'user-management': () => (
      <Card title="Gestión de Usuarios" className="h-full">
        <div className="text-center py-4">
          <Typography.Title level={2} className="!text-blue-600">
            {data.totalStaff || 0}
          </Typography.Title>
          <Typography.Text type="secondary">Usuarios Activos</Typography.Text>
        </div>
      </Card>
    ),
    'office-overview': () => (
      <Card title="Resumen de Oficinas" className="h-full">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Typography.Text>Oficina Principal</Typography.Text>
            <Tag color="green">Activa</Tag>
          </div>
          <div className="flex justify-between">
            <Typography.Text>Oficina Norte</Typography.Text>
            <Tag color="green">Activa</Tag>
          </div>
          <div className="flex justify-between">
            <Typography.Text>Oficina Sur</Typography.Text>
            <Tag color="orange">Mantenimiento</Tag>
          </div>
        </div>
      </Card>
    ),
    'office-stats': () => (
      <Card title="Estadísticas de Oficina" className="h-full">
        <div className="text-center py-4">
          <Typography.Title level={2} className="!text-blue-600">
            {data.totalOpenCases || 0}
          </Typography.Title>
          <Typography.Text type="secondary">Casos en esta Oficina</Typography.Text>
        </div>
      </Card>
    ),
    'staff-performance': () => (
      <Card title="Rendimiento del Personal" className="h-full">
        <Progress
          type="circle"
          percent={data.staffPerformance || 85}
          strokeColor="#52c41a"
          size={100}
        />
        <div className="text-center mt-4">
          <Typography.Text type="secondary">Meta: 90%</Typography.Text>
        </div>
      </Card>
    ),
    'case-load': () => (
      <Card title="Carga de Casos" className="h-full">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Typography.Text>Casos Activos</Typography.Text>
            <Typography.Text strong>{data.myOpenCases || 0}</Typography.Text>
          </div>
          <div className="flex justify-between">
            <Typography.Text>Tareas Pendientes</Typography.Text>
            <Typography.Text strong>{data.myPendingTasks || 0}</Typography.Text>
          </div>
          <Progress percent={75} strokeColor="#1890ff" />
        </div>
      </Card>
    ),
    'upcoming-appointments': () => (
      <Card title="Próximas Citas" className="h-full">
        <div className="text-center py-4">
          <Typography.Title level={2} className="!text-green-600">
            {data.myUpcomingAppointments || 0}
          </Typography.Title>
          <Typography.Text type="secondary">Citas Programadas</Typography.Text>
        </div>
      </Card>
    ),
    'today-appointments': () => (
      <Card title="Citas de Hoy" className="h-full">
        <div className="text-center py-4">
          <Typography.Title level={2} className="!text-orange-600">
            {data.appointmentsToday || 0}
          </Typography.Title>
          <Typography.Text type="secondary">Citas para Hoy</Typography.Text>
        </div>
      </Card>
    ),
    'client-check-ins': () => (
      <Card title="Registros de Clientes" className="h-full">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Typography.Text>Clientes Nuevos</Typography.Text>
            <Typography.Text strong>5</Typography.Text>
          </div>
          <div className="flex justify-between">
            <Typography.Text>Registros Hoy</Typography.Text>
            <Typography.Text strong>12</Typography.Text>
          </div>
        </div>
      </Card>
    ),
    'upcoming-events': () => (
      <Card title="Próximos Eventos" className="h-full">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Typography.Text>Taller Legal</Typography.Text>
            <Tag color="blue">Mañana</Tag>
          </div>
          <div className="flex justify-between">
            <Typography.Text>Sesión Grupal</Typography.Text>
            <Tag color="green">Esta Semana</Tag>
          </div>
        </div>
      </Card>
    ),
    'event-registrations': () => (
      <Card title="Registros de Eventos" className="h-full">
        <div className="text-center py-4">
          <Typography.Title level={2} className="!text-purple-600">
            24
          </Typography.Title>
          <Typography.Text type="secondary">Registros Esta Semana</Typography.Text>
        </div>
      </Card>
    ),
  };

  return (
    <div className="space-y-6">
      {/* Role-specific widgets */}
      <Row gutter={[16, 16]}>
        {availableWidgets.map((widget) => {
           const WidgetComponent = widgetComponents[widget as keyof typeof widgetComponents];
          if (!WidgetComponent) return null;
          
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={widget}>
              <WidgetComponent />
            </Col>
          );
        })}
      </Row>

      {/* Role-specific additional content */}
       {userRole && isValidRole(userRole) && (PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('*') || PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('admin_widgets')) && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Rendimiento del Sistema">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Typography.Text>Uptime del Servidor</Typography.Text>
                  <Typography.Text strong>99.9%</Typography.Text>
                </div>
                <Progress percent={99.9} strokeColor="#52c41a" />
                
                <div className="flex justify-between">
                  <Typography.Text>Uso de Base de Datos</Typography.Text>
                  <Typography.Text strong>45%</Typography.Text>
                </div>
                <Progress percent={45} strokeColor="#1890ff" />
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Actividad Reciente">
              <Timeline>
                <Timeline.Item color="green">
                  <Typography.Text strong>Sistema actualizado</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" className="text-xs">Hace 2 horas</Typography.Text>
                </Timeline.Item>
                <Timeline.Item color="blue">
                  <Typography.Text strong>Nuevo usuario registrado</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" className="text-xs">Hace 4 horas</Typography.Text>
                </Timeline.Item>
              </Timeline>
            </Card>
          </Col>
        </Row>
      )}

       {userRole && isValidRole(userRole) && (PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('*') || PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('professional_widgets')) && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Mi Rendimiento">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Typography.Text>Casos Completados</Typography.Text>
                  <Typography.Text strong>12</Typography.Text>
                </div>
                <Progress percent={80} strokeColor="#52c41a" />

                <div className="flex justify-between">
                  <Typography.Text>Puntualidad</Typography.Text>
                  <Typography.Text strong>95%</Typography.Text>
                </div>
                <Progress percent={95} strokeColor="#1890ff" />
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Logros Recientes">
              <Timeline>
                <Timeline.Item color="green">
                  <Typography.Text strong>Completaste 5 casos esta semana</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" className="text-xs">Hace 2 horas</Typography.Text>
                </Timeline.Item>
                <Timeline.Item color="blue">
                  <Typography.Text strong>Nueva certificación obtenida</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" className="text-xs">Hace 1 día</Typography.Text>
                </Timeline.Item>
              </Timeline>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

// Loading component for lazy-loaded sections
const SectionLoading = () => (
  <div className="flex justify-center items-center h-32">
    <Spin size="large" tip="Cargando sección..." />
  </div>
);

// --- Main Page Component ---
const TrueDashboardPage = () => {
  const router = useRouter();
  const isHydrated = useHydrationSafe();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Wait a bit to ensure token is properly set after login
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify token is available before making API calls
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token available, skipping dashboard data fetch');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Fetch dashboard data and recent activity in parallel
      const [summaryResponse, activityResponse] = await Promise.all([
        apiClient.get('/dashboard-summary'),
        apiClient.get('/recent-activity').catch(() => ({ data: [] })) // Graceful fallback
      ]);
      
      setSummaryData(summaryResponse.data);
      setRecentActivity(activityResponse.data || []);
      
      if (isRefresh) {
        message.success('Dashboard actualizado correctamente');
      }
    } catch (error: any) {
      console.error('Dashboard data fetch error:', error);
      
      // If it's a 401 error, try again after a short delay (token might not be ready)
      if (error?.response?.status === 401) {
        console.log('Retrying dashboard data fetch after 401 error...');
        setTimeout(async () => {
          try {
            const retryResponse = await apiClient.get('/dashboard-summary');
            setSummaryData(retryResponse.data);
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            message.error('No se pudo cargar el resumen del dashboard.');
          } finally {
            setLoading(false);
            setRefreshing(false);
          }
        }, 500);
        return;
      }
      
      message.error('No se pudo cargar el resumen del dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration to complete
    
    const role = localStorage.getItem('userRole');
    setUserRole(role);
    fetchDashboardData();
  }, [isHydrated]);

  // Quick actions based on user role
  const quickActions = useMemo(() => {
    const baseActions = [
      {
        label: 'Nueva Cita',
        icon: <PlusOutlined />,
        onClick: () => router.push('/app/appointments'),
        color: '#4f46e5',
        gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
      },
      {
        label: 'Ver Calendario',
        icon: <CalendarOutlined />,
        onClick: () => router.push('/app/calendar'),
        color: '#52c41a',
        gradient: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
      },
      {
        label: 'Buscar Casos',
        icon: <SearchOutlined />,
        onClick: () => router.push('/app/cases'),
        color: '#1890ff',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)'
      }
    ];

        if (userRole && isValidRole(userRole)) {
          const staffRole = userRole as StaffRoleKey;
      
       if (PERMISSIONS[staffRole as keyof typeof PERMISSIONS]?.includes('manage_users') || PERMISSIONS[staffRole as keyof typeof PERMISSIONS]?.includes('*')) {
        baseActions.push({
          label: 'Gestión de Usuarios',
          icon: <TeamOutlined />,
          onClick: () => router.push('/app/users'),
          color: '#722ed1',
          gradient: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)'
        });
      }
      
       if (PERMISSIONS[staffRole as keyof typeof PERMISSIONS]?.includes('manage_offices') || PERMISSIONS[staffRole as keyof typeof PERMISSIONS]?.includes('*')) {
        baseActions.push({
          label: 'Gestión de Oficinas',
          icon: <BarChartOutlined />,
          onClick: () => router.push('/app/offices'),
          color: '#fa8c16',
          gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)'
        });
      }
    }

    return baseActions;
  }, [userRole, router]);

  // CRITICAL FIX: No early returns to prevent React error #310
  // All hooks must be called on every render, regardless of loading state
  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" tip="Cargando resumen..." />
        </div>
      ) : (
        <>
          {/* Header with Actions - Enhanced Mobile */}
          <div className="flex flex-col gap-4">
        <div className="text-center sm:text-left">
          <Typography.Title level={1} className="!mb-2 !text-2xl sm:!text-3xl font-bold text-gray-800">
            Dashboard
          </Typography.Title>
          <Typography.Text type="secondary" className="text-base sm:text-lg">
            Bienvenido de vuelta al Sistema CAF
          </Typography.Text>
        </div>
        
        {/* Mobile-optimized action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
              loading={refreshing}
              className="flex-1 sm:flex-none border-blue-500 text-blue-500 hover:bg-blue-50"
              size="large"
            >
              <span className="sm:hidden">Actualizar</span>
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
          
          <div className="grid grid-cols-2 sm:flex gap-2">
            {quickActions.slice(0, 4).map((action, index) => (
              <Button 
                key={index}
                type="primary" 
                icon={action.icon}
                onClick={action.onClick}
                className="text-xs sm:text-sm"
                size="large"
                style={{ 
                  background: action.gradient,
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: `0 4px 12px ${action.color}30`
                }}
              >
                <span className="hidden sm:inline">{action.label}</span>
                <span className="sm:hidden">{action.label.split(' ')[0]}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8">
        {userRole && isValidRole(userRole) ? (
          <RoleBasedDashboard data={summaryData || {}} userRole={userRole as StaffRoleKey} />
        ) : (
          <div className="flex justify-center items-center h-32">
            <Spin size="large" tip="Cargando dashboard..." />
          </div>
        )}
      </div>

      {/* Enhanced Content Sections - Mobile Optimized */}
      <Row gutter={[16, 16]}>
        {/* Real-time Notifications */}
        <Col xs={24} lg={8}>
          <Suspense fallback={<SectionLoading />}>
            <RealTimeNotifications />
          </Suspense>
        </Col>

        {/* Quick Actions Grid */}
        <Col xs={24} lg={8}>
          <Card 
            title={
              <div className="flex items-center">
                <ThunderboltOutlined className="mr-2 text-purple-500" />
                <span className="text-sm sm:text-base">Acciones Rápidas</span>
              </div>
            }
            className="h-full"
          >
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  type="text"
                  className="h-16 sm:h-20 flex flex-col items-center justify-center border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                  onClick={action.onClick}
                >
                  <div 
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mb-1 sm:mb-2"
                    style={{ backgroundColor: `${action.color}20` }}
                  >
                    {React.cloneElement(action.icon as React.ReactElement, { 
                      style: { color: action.color, fontSize: '12px' } 
                    })}
                  </div>
                  <Typography.Text className="text-xs text-center leading-tight">
                    {action.label}
                  </Typography.Text>
                </Button>
              ))}
            </div>
          </Card>
        </Col>

        {/* System Status */}
        <Col xs={24} lg={8}>
          <Card 
            title={
              <div className="flex items-center">
                <HeartOutlined className="mr-2 text-red-500" />
                <span className="text-sm sm:text-base">Estado del Sistema</span>
              </div>
            }
            className="h-full"
          >
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <Typography.Text className="text-sm sm:text-base">Servidor</Typography.Text>
                <Tag color="green" icon={<CheckCircleOutlined />} className="text-xs sm:text-sm">
                  Operativo
                </Tag>
              </div>
              <div className="flex items-center justify-between">
                <Typography.Text className="text-sm sm:text-base">Base de Datos</Typography.Text>
                <Tag color="green" icon={<CheckCircleOutlined />} className="text-xs sm:text-sm">
                  Conectada
                </Tag>
              </div>
              <div className="flex items-center justify-between">
                <Typography.Text className="text-sm sm:text-base">Almacenamiento</Typography.Text>
                <Tag color="blue" icon={<CheckCircleOutlined />} className="text-xs sm:text-sm">
                  85% Usado
                </Tag>
              </div>
              <Divider className="!my-2 sm:!my-3" />
              <div className="text-center">
                <Typography.Text type="secondary" className="text-xs">
                  Última actualización: {new Date().toLocaleTimeString()}
                </Typography.Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts and Analytics Section */}
      <Suspense fallback={<SectionLoading />}>
         {userRole && isValidRole(userRole) &&
          (PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('*') || PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('admin_widgets')) && (
          <DashboardCharts />
        )}
      </Suspense>

      {/* Announcements and Customization Section - Mobile Optimized */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card 
            title={
              <div className="flex items-center">
                <BellOutlined className="mr-2 text-blue-500" />
                <span className="text-sm sm:text-base">Anuncios Recientes</span>
              </div>
            }
            className="h-full"
          >
            <Suspense fallback={<SectionLoading />}>
              <AnnouncementsPanel />
            </Suspense>
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Suspense fallback={<SectionLoading />}>
             {userRole && isValidRole(userRole) &&
              (PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('*') || PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes('office_manager_widgets')) && (
              <Card 
                title={
                  <div className="flex items-center">
                    <SettingOutlined className="mr-2 text-purple-500" />
                    <span className="text-sm sm:text-base">Gestión de Anuncios</span>
                  </div>
                }
                className="h-full"
              >
                <AdminAnnouncementsManager />
              </Card>
            )}
          </Suspense>
        </Col>

        <Col xs={24} lg={8}>
          <Suspense fallback={<SectionLoading />}>
            <DashboardCustomization />
          </Suspense>
        </Col>
      </Row>
        </>
      )}
    </div>
  );
};

export default TrueDashboardPage;






