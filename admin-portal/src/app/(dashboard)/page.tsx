// admin-portal/src/app/(dashboard)/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button, Card, Col, Row, Statistic, Spin, message, Select, Typography, Divider, Empty,
} from 'antd';
import {
  FolderOpenOutlined, CalendarOutlined, TeamOutlined, BarChartOutlined,
  ClockCircleOutlined, CheckCircleOutlined, BellOutlined, ReloadOutlined, RightOutlined,
  UserOutlined, BankOutlined,
  ScheduleOutlined, ExclamationCircleOutlined, RiseOutlined,
} from '@ant-design/icons';
import { apiClient } from '../lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import NotificationCard from './components/NotificationCard';
import { formatSyncTime, resolveNotificationHref } from './components/notificationPresentation';

const { Text, Title } = Typography;

// --- TypeScript Interfaces ---
interface DashboardData {
  // Case statistics
  totalCases: number;
  openCases: number;
  completedCases: number;
  casesThisMonth: number;
  myCases?: number;
  myOpenCases?: number;
  myCompletedCases?: number;

  // Appointment statistics
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  appointmentsToday: number;
  appointmentsThisWeek?: number;
  myAppointments?: number;
  myPendingAppointments?: number;
  myAppointmentsToday?: number;

  // Admin-only stats
  totalStaff?: number;
  totalClients?: number;
  pendingTasks?: number;
  myPendingTasks?: number;

  // Office filter
  offices?: Array<{ id: number; name: string }>;
}

// --- Stat Card Component ---
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
}> = ({ title, value, icon, color, suffix }) => (
  <Card className="text-center" hoverable size="small" style={{ borderTop: `3px solid ${color}` }}>
    <div className="flex items-center justify-center mb-1" style={{ color }}>
      {icon}
    </div>
    <Statistic
      title={<span style={{ fontSize: 12 }}>{title}</span>}
      value={value}
      suffix={suffix}
      valueStyle={{ color, fontSize: 22, fontWeight: 'bold' }}
    />
  </Card>
);

// --- Main Page Component ---
const TrueDashboardPage = () => {
  const router = useRouter();
  const isHydrated = useHydrationSafe();
  const { user } = useAuth();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [offices, setOffices] = useState<Array<{ id: number; name: string }>>([]);
  const initializedRef = useRef(false);

  const {
    notifications: contextNotifications,
    unreadCount: contextUnreadCount,
    isRefreshing: notificationsRefreshing,
    wsConnected,
    lastUpdatedAt,
    markAsRead,
    refreshNotifications,
  } = useNotifications();
  const recentNotifications = contextNotifications.slice(0, 5);

  const isStaffRole = useMemo(() =>
    ['lawyer', 'psychologist', 'receptionist', 'event_coordinator'].includes(userRole || ''),
    [userRole]
  );
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'office_manager';

  // Fetch offices
  const fetchOffices = async () => {
    try {
      const response = await apiClient.get('/offices');
      setOffices(response.data || []);
    } catch {
      // Non-critical, continue without offices
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async (officeId?: string, overrideRole?: string) => {
    const effectiveRole = overrideRole || userRole;
    if (!effectiveRole) return;

    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (officeId && (effectiveRole === 'admin' || effectiveRole === 'office_manager')) {
        params.append('officeId', officeId);
      }

      let endpoint = '/dashboard-summary';
      if (!['admin', 'office_manager'].includes(effectiveRole)) {
        endpoint = '/staff/dashboard-summary';
      }

      const queryString = params.toString();
      const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
      const response = await apiClient.get(fullEndpoint);
      const rawData = response.data;

      let processedData: DashboardData;

      if (effectiveRole === 'admin') {
        processedData = {
          totalCases: rawData.totalCases || 0,
          openCases: rawData.openCases || 0,
          completedCases: rawData.completedCases || 0,
          casesThisMonth: rawData.casesThisMonth || 0,
          totalAppointments: rawData.totalAppointments || 0,
          pendingAppointments: rawData.pendingAppointments || 0,
          completedAppointments: rawData.completedAppointments || 0,
          appointmentsToday: rawData.appointmentsToday || 0,
          appointmentsThisWeek: rawData.appointmentsThisWeek || 0,
          totalStaff: rawData.totalStaff || 0,
          totalClients: rawData.totalClients || 0,
          pendingTasks: rawData.pendingTasks || 0,
          offices: offices.length > 0 ? offices : undefined,
        };
      } else if (effectiveRole === 'office_manager') {
        processedData = {
          totalCases: rawData.totalCases || 0,
          openCases: rawData.openCases || 0,
          completedCases: rawData.completedCases || 0,
          casesThisMonth: rawData.casesThisMonth || 0,
          totalAppointments: rawData.totalAppointments || 0,
          pendingAppointments: rawData.pendingAppointments || 0,
          completedAppointments: rawData.completedAppointments || 0,
          appointmentsToday: rawData.appointmentsToday || 0,
          appointmentsThisWeek: rawData.appointmentsThisWeek || 0,
          totalStaff: rawData.totalStaff || 0,
          pendingTasks: rawData.pendingTasks || 0,
          offices: offices.length > 0 ? offices : undefined,
        };
      } else {
        processedData = {
          totalCases: 0,
          openCases: 0,
          completedCases: 0,
          casesThisMonth: 0,
          myCases: rawData.myCases || 0,
          myOpenCases: rawData.myOpenCases || 0,
          myCompletedCases: rawData.myCompletedCases || 0,
          totalAppointments: 0,
          pendingAppointments: 0,
          completedAppointments: 0,
          appointmentsToday: 0,
          myAppointments: rawData.myAppointments || 0,
          myPendingAppointments: rawData.myPendingAppointments || 0,
          myAppointmentsToday: rawData.myAppointmentsToday || 0,
          myPendingTasks: rawData.myPendingTasks || 0,
        };
      }

      setDashboardData(processedData);
    } catch {
      message.error('No se pudo cargar el resumen del dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleOfficeChange = (officeId: string | undefined) => {
    const value = officeId ?? '';
    setSelectedOfficeId(value);
    fetchDashboardData(value || undefined);
  };

  // Auto-refresh
  useEffect(() => {
    if (!userRole || !dashboardData) return;
    const interval = setInterval(() => {
      fetchDashboardData(selectedOfficeId || undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, [userRole, dashboardData, selectedOfficeId]);

  // Initialize
  useEffect(() => {
    if (!isHydrated || !user?.role || initializedRef.current) return;
    initializedRef.current = true;
    const role = user.role;
    setUserRole(role);
    fetchOffices();
    const managerOfficeId =
      role === 'office_manager' &&
      (user?.officeId != null
        ? String(user.officeId)
        : typeof window !== 'undefined'
          ? localStorage.getItem('userOfficeId') ?? ''
          : '');
    const initialOfficeId = role === 'office_manager' ? managerOfficeId : '';
    if (initialOfficeId) setSelectedOfficeId(initialOfficeId);
    fetchDashboardData(initialOfficeId || undefined, role);
  }, [isHydrated, user?.role, user?.officeId]);

  // Handle logout
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user) {
      setUserRole(null);
      setDashboardData(null);
      initializedRef.current = false;
    }
    prevUserRef.current = user;
  }, []);

  if (!isHydrated || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip={isHydrated ? "Cargando resumen..." : "Cargando..."} />
      </div>
    );
  }

  if (!userRole || !dashboardData) {
    return (
      <div className="flex justify-center items-center h-32">
        <Spin size="large" tip="Cargando datos del dashboard..." />
      </div>
    );
  }

  const unreadCount = contextUnreadCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title level={2} className="!mb-1">Panel de Control</Title>
          <Text type="secondary">
            {isStaffRole ? 'Resumen de tus casos y citas asignadas' : 'Resumen general del sistema'}
          </Text>
        </div>
      </div>

      {/* ========== ADMIN/MANAGER SECTIONS ========== */}
      {(isAdmin || isManager) && (
        <>
          {/* Admin-Only: System Overview */}
          {isAdmin && (
            <>
              <Divider orientation="left" style={{ fontSize: 14, color: '#6b7280' }}>
                <TeamOutlined /> Resumen del Sistema
              </Divider>
              <Row gutter={[12, 12]}>
                <Col xs={12} sm={8} md={6}>
                  <StatCard title="Total Personal" value={dashboardData.totalStaff || 0} icon={<TeamOutlined style={{ fontSize: 20 }} />} color="#1890ff" />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <StatCard title="Total Clientes" value={dashboardData.totalClients || 0} icon={<UserOutlined style={{ fontSize: 20 }} />} color="#13c2c2" />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <StatCard title="Tareas Pendientes" value={dashboardData.pendingTasks || 0} icon={<ExclamationCircleOutlined style={{ fontSize: 20 }} />} color="#fa8c16" />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <StatCard title="Citas Esta Semana" value={dashboardData.appointmentsThisWeek || 0} icon={<ScheduleOutlined style={{ fontSize: 20 }} />} color="#722ed1" />
                </Col>
              </Row>
            </>
          )}

          {/* Office Filter - Admin/Manager */}
          {(isAdmin || isManager) && offices.length > 0 && (
            <Card size="small">
              <div className="flex items-center gap-4">
                <BankOutlined />
                <Text strong>Filtrar por Oficina:</Text>
                <Select
                  placeholder="Todas las oficinas"
                  value={selectedOfficeId || undefined}
                  onChange={handleOfficeChange}
                  style={{ minWidth: 200 }}
                  allowClear
                >
                  {offices.map(office => (
                    <Select.Option key={office.id} value={office.id.toString()}>
                      {office.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </Card>
          )}

          {/* Case Statistics */}
          <Divider orientation="left" style={{ fontSize: 14, color: '#6b7280' }}>
            <FolderOpenOutlined /> Estadísticas de Casos
          </Divider>
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Total Casos" value={dashboardData.totalCases} icon={<FolderOpenOutlined style={{ fontSize: 20 }} />} color="#1890ff" />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Casos Activos" value={dashboardData.openCases} icon={<ClockCircleOutlined style={{ fontSize: 20 }} />} color="#fa8c16" />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Completados" value={dashboardData.completedCases} icon={<CheckCircleOutlined style={{ fontSize: 20 }} />} color="#52c41a" />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Este Mes" value={dashboardData.casesThisMonth} icon={<RiseOutlined style={{ fontSize: 20 }} />} color="#722ed1" />
            </Col>
          </Row>

          {/* Appointment Statistics */}
          <Divider orientation="left" style={{ fontSize: 14, color: '#6b7280' }}>
            <CalendarOutlined /> Estadísticas de Citas
          </Divider>
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Total Citas" value={dashboardData.totalAppointments} icon={<CalendarOutlined style={{ fontSize: 20 }} />} color="#13c2c2" />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Pendientes" value={dashboardData.pendingAppointments} icon={<ClockCircleOutlined style={{ fontSize: 20 }} />} color="#fa8c16" />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Completadas" value={dashboardData.completedAppointments} icon={<CheckCircleOutlined style={{ fontSize: 20 }} />} color="#52c41a" />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard title="Hoy" value={dashboardData.appointmentsToday} icon={<CalendarOutlined style={{ fontSize: 20 }} />} color="#722ed1" />
            </Col>
          </Row>
        </>
      )}

      {/* ========== STAFF SECTIONS ========== */}
      {isStaffRole && (
        <>
          {/* Quick Overview */}
          <Divider orientation="left" style={{ fontSize: 14, color: '#6b7280' }}>
            <BarChartOutlined /> Tu Resumen
          </Divider>
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={8} md={6}>
              <StatCard title="Mis Casos" value={dashboardData.myCases || 0} icon={<FolderOpenOutlined style={{ fontSize: 20 }} />} color="#1890ff" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <StatCard title="Casos Abiertos" value={dashboardData.myOpenCases || 0} icon={<ClockCircleOutlined style={{ fontSize: 20 }} />} color="#fa8c16" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <StatCard title="Completados Este Mes" value={dashboardData.myCompletedCases || 0} icon={<CheckCircleOutlined style={{ fontSize: 20 }} />} color="#52c41a" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <StatCard title="Mis Citas" value={dashboardData.myAppointments || 0} icon={<CalendarOutlined style={{ fontSize: 20 }} />} color="#13c2c2" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <StatCard title="Citas Pendientes" value={dashboardData.myPendingAppointments || 0} icon={<ClockCircleOutlined style={{ fontSize: 20 }} />} color="#fa8c16" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <StatCard title="Citas Hoy" value={dashboardData.myAppointmentsToday || 0} icon={<CalendarOutlined style={{ fontSize: 20 }} />} color="#722ed1" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <StatCard title="Tareas Pendientes" value={dashboardData.myPendingTasks || 0} icon={<ExclamationCircleOutlined style={{ fontSize: 20 }} />} color="#eb2f96" />
            </Col>
          </Row>
        </>
      )}

      <Card className="notification-summary-card" bodyStyle={{ padding: 20 }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-100 text-xl text-sky-700">
              <BellOutlined />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Title level={5} className="!mb-0">
                  Bandeja de notificaciones
                </Title>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    wsConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {wsConnected ? 'En vivo' : 'Reconectando'}
                </span>
                {unreadCount > 0 && (
                  <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              <Text type="secondary" className="mt-2 block">
                Resumen rapido de la actividad mas reciente del portal.
              </Text>
              <Text type="secondary" className="mt-1 block text-xs">
                Ultima sincronizacion: {formatSyncTime(lastUpdatedAt)}
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void refreshNotifications()}
              loading={notificationsRefreshing}
            >
              Actualizar
            </Button>
            <Button
              type="primary"
              icon={<RightOutlined />}
              onClick={() => router.push('/app/notifications')}
            >
              Abrir centro
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sin leer</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{unreadCount}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total reciente</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{contextNotifications.length}</div>
          </div>
        </div>

        <div className="mt-4">
        {recentNotifications.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recentNotifications.map((item) => (
              <NotificationCard
                key={item.id}
                notification={item}
                onClick={() => {
                  if (!item.isRead) {
                    void markAsRead(item.id);
                  }
                  const href = resolveNotificationHref(item);
                  if (href) {
                    router.push(href);
                  }
                }}
                onMarkAsRead={
                  item.isRead
                    ? undefined
                    : () => {
                        void markAsRead(item.id);
                      }
                }
                compact
              />
            ))}
          </div>
        ) : (
          <Empty description="No hay notificaciones recientes" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        </div>
      </Card>
    </div>
  );
};

export default TrueDashboardPage;
