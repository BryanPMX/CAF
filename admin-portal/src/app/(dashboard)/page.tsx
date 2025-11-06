// admin-portal/src/app/(dashboard)/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Select,
  Typography,
  Alert
} from 'antd';
import {
  FolderOpenOutlined,
  CalendarOutlined,
  TeamOutlined,
  PlusOutlined,
  ReloadOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { apiClient } from '../lib/api';
import { useAuth } from '@/context/AuthContext';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';

// --- TypeScript Interfaces ---
interface DashboardData {
  // Case statistics
  totalCases: number;
  openCases: number;
  completedCases: number;
  casesThisMonth: number;
  myCases?: number;
  myOpenCases?: number;

  // Appointment statistics
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  appointmentsToday: number;
  myAppointments?: number;
  myPendingAppointments?: number;

  // Office filter (for admins)
  offices?: Array<{ id: number; name: string }>;
}

interface Office {
  id: number;
  name: string;
}

// Removed StatCard component - using inline cards to avoid undefined component issues

// --- Secure Role-Based Dashboard Component ---
const RoleBasedDashboard: React.FC<{
  data: DashboardData;
  userRole: string;
  selectedOfficeId?: string;
  onOfficeChange?: (officeId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}> = ({ data, userRole, selectedOfficeId, onOfficeChange, onRefresh, loading }) => {
  // Determine what statistics to show based on role
  const canSeeAllOffices = userRole === 'admin';
  const canSeeOfficeFilter = userRole === 'admin' || userRole === 'office_manager';
  const isStaffRole = ['lawyer', 'psychologist', 'receptionist', 'event_coordinator'].includes(userRole);

  console.log('RoleBasedDashboard rendering:', { userRole, canSeeAllOffices, canSeeOfficeFilter, isStaffRole, dataKeys: Object.keys(data) });

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Typography.Title level={2} className="!mb-1">
            Dashboard
          </Typography.Title>
          <Typography.Text type="secondary">
            Resumen de casos y citas
            {selectedOfficeId && data.offices && data.offices.length > 0 && (
              <span> - {data.offices.find(o => o.id.toString() === selectedOfficeId)?.name || 'Oficina'}</span>
            )}
          </Typography.Text>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
          >
            Actualizar
          </Button>
        </Space>
      </div>

      {/* Office Filter for admins and office managers */}
      {canSeeOfficeFilter && data.offices && data.offices.length > 0 && (
        <Card size="small">
          <div className="flex items-center gap-4">
            <Typography.Text strong>Filtrar por Oficina:</Typography.Text>
            <Select
              placeholder="Seleccionar oficina"
              value={selectedOfficeId}
              onChange={onOfficeChange}
              style={{ minWidth: 200 }}
              allowClear
            >
              {data.offices.map(office => (
                <Select.Option key={office.id} value={office.id.toString()}>
                  {office.name || `Office ${office.id}`}
                </Select.Option>
              ))}
            </Select>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      {data && (
        <Row gutter={[16, 16]}>
          {/* Case Statistics */}
          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <FolderOpenOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              </div>
              <Statistic
                title="Total Casos"
                value={isStaffRole ? (data.myCases || 0) : (data.totalCases || 0)}
                valueStyle={{ color: '#1890ff', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <ClockCircleOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
              </div>
              <Statistic
                title="Casos Activos"
                value={isStaffRole ? (data.myOpenCases || 0) : (data.openCases || 0)}
                valueStyle={{ color: '#fa8c16', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
              </div>
              <Statistic
                title="Casos Completados"
                value={data.completedCases || 0}
                valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <BarChartOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
              </div>
              <Statistic
                title="Casos Este Mes"
                value={data.casesThisMonth || 0}
                valueStyle={{ color: '#722ed1', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>

          {/* Appointment Statistics */}
          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CalendarOutlined style={{ fontSize: '24px', color: '#13c2c2' }} />
              </div>
              <Statistic
                title="Total Citas"
                value={isStaffRole ? (data.myAppointments || 0) : (data.totalAppointments || 0)}
                valueStyle={{ color: '#13c2c2', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <ClockCircleOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
              </div>
              <Statistic
                title="Citas Pendientes"
                value={isStaffRole ? (data.myPendingAppointments || 0) : (data.pendingAppointments || 0)}
                valueStyle={{ color: '#fa8c16', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
              </div>
              <Statistic
                title="Citas Completadas"
                value={data.completedAppointments || 0}
                valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CalendarOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
              </div>
              <Statistic
                title="Citas Hoy"
                value={data.appointmentsToday || 0}
                valueStyle={{ color: '#722ed1', fontSize: '24px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Staff-specific message */}
      {isStaffRole && (
        <Alert
          message="Vista de Personal"
          description="Mostrando solo casos y citas asignados a usted."
          type="info"
          showIcon
        />
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
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [offices, setOffices] = useState<Office[]>([]);
  const initializedRef = useRef(false);
  const renderCountRef = useRef(0);

  // Fetch offices for admin/office manager filtering
  const fetchOffices = async () => {
    try {
      const response = await apiClient.get('/offices');
      setOffices(response.data || []);
    } catch (error) {
      console.warn('Failed to fetch offices:', error);
      // Don't show error for offices, just continue without them
    }
  };

  // Secure dashboard data fetching with role-based filtering
  const fetchDashboardData = async (officeId?: string) => {
    if (!userRole) return;

    try {
      setLoading(true);

      // Build query parameters based on role and selected office
      const params = new URLSearchParams();
      if (officeId && (userRole === 'admin' || userRole === 'office_manager')) {
        params.append('officeId', officeId);
      }

      // Determine endpoint based on role
      let endpoint = '/api/v1/dashboard-summary';
      if (userRole !== 'admin' && userRole !== 'office_manager') {
        endpoint = '/api/v1/staff/dashboard-summary';
      }

      const queryString = params.toString();
      const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

      const response = await apiClient.get(fullEndpoint);

      // Transform data based on role permissions
      const rawData = response.data;
      let processedData: DashboardData;

      if (userRole === 'admin') {
        // Admin sees all data
        processedData = {
          totalCases: rawData.totalCases || 0,
          openCases: rawData.openCases || 0,
          completedCases: rawData.completedCases || 0,
          casesThisMonth: rawData.casesThisMonth || 0,
          totalAppointments: rawData.totalAppointments || 0,
          pendingAppointments: rawData.pendingAppointments || 0,
          completedAppointments: rawData.completedAppointments || 0,
          appointmentsToday: rawData.appointmentsToday || 0,
          offices: offices.length > 0 ? offices : undefined,
        };
      } else if (userRole === 'office_manager') {
        // Office manager sees office-specific or all-office data
        processedData = {
          totalCases: rawData.totalCases || 0,
          openCases: rawData.openCases || 0,
          completedCases: rawData.completedCases || 0,
          casesThisMonth: rawData.casesThisMonth || 0,
          totalAppointments: rawData.totalAppointments || 0,
          pendingAppointments: rawData.pendingAppointments || 0,
          completedAppointments: rawData.completedAppointments || 0,
          appointmentsToday: rawData.appointmentsToday || 0,
          offices: offices.length > 0 ? offices : undefined,
        };
      } else {
        // Staff roles see only their assigned data
        processedData = {
          totalCases: 0,
          openCases: 0,
          completedCases: 0,
          casesThisMonth: 0,
          myCases: rawData.myCases || 0,
          myOpenCases: rawData.myOpenCases || 0,
          totalAppointments: 0,
          pendingAppointments: 0,
          completedAppointments: 0,
          appointmentsToday: 0,
          myAppointments: rawData.myAppointments || 0,
          myPendingAppointments: rawData.myPendingAppointments || 0,
        };
      }

      setDashboardData(processedData);
    } catch (error: any) {
      console.error('Dashboard data fetch error:', error);
      message.error('No se pudo cargar el resumen del dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Handle office filter change
  const handleOfficeChange = (officeId: string) => {
    setSelectedOfficeId(officeId);
    fetchDashboardData(officeId);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchDashboardData(selectedOfficeId || undefined);
  };

  // Initialize dashboard only once when user becomes available
  useEffect(() => {
    if (!isHydrated || !user?.role || initializedRef.current) return;

    initializedRef.current = true;
    const role = user.role;
    console.log('Dashboard: Initialized with user role:', role);
    setUserRole(role);

    // Always fetch offices for UI (needed for office filtering dropdown)
    fetchOffices();

    // For office managers, auto-select their office (temporary fix)
    // In production, this should come from user profile
    if (role === 'office_manager') {
      setSelectedOfficeId('2'); // Default office for office managers
    }

    // Fetch dashboard data
    fetchDashboardData(role === 'office_manager' ? '2' : undefined);
  }, [isHydrated]); // Removed user?.role and userRole dependencies to prevent loops

  // Handle user logout only - run once on mount and track user state internally
  const prevUserRef = useRef(user);
  useEffect(() => {
    const prevUser = prevUserRef.current;
    const currentUser = user;

    // Only handle logout (user going from exists to null)
    if (prevUser && !currentUser) {
      console.log('Dashboard: User logged out, resetting state');
      setUserRole(null);
      setDashboardData(null);
      initializedRef.current = false;
    }

    prevUserRef.current = currentUser;
  }, []); // Empty dependency array - handle logout manually

  // CRITICAL FIX: No early returns to prevent React error #310
  // All hooks must be called on every render, regardless of loading state
  renderCountRef.current += 1;

  // Only log every 5 renders to reduce noise, or always log if render count is low
  if (renderCountRef.current <= 10 || renderCountRef.current % 5 === 0) {
    console.log(`Dashboard rendering #${renderCountRef.current}:`, {
      userRole,
      loading,
      dashboardData: !!dashboardData,
      userExists: !!user,
      userRoleFromAuth: user?.role,
      initialized: initializedRef.current
    });
  }

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
              loading={loading}
              className="flex-1 sm:flex-none border-blue-500 text-blue-500 hover:bg-blue-50"
              size="large"
            >
              <span className="sm:hidden">Actualizar</span>
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8">
        {userRole && dashboardData && !loading ? (
          <RoleBasedDashboard
            data={dashboardData}
            userRole={userRole}
            selectedOfficeId={selectedOfficeId}
            onOfficeChange={handleOfficeChange}
            onRefresh={handleRefresh}
            loading={loading}
          />
        ) : (
          <div className="flex justify-center items-center h-32">
            <Spin size="large" tip={loading ? "Cargando dashboard..." : "Esperando datos..."} />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {userRole && (
        <Card title="Acciones Rápidas" size="small">
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<PlusOutlined />}
              onClick={() => router.push('/app/cases')}
              type="primary"
            >
              Nuevo Caso
            </Button>
            <Button
              icon={<CalendarOutlined />}
              onClick={() => router.push('/app/appointments')}
            >
              Programar Cita
            </Button>
            {userRole === 'admin' && (
              <Button
                icon={<TeamOutlined />}
                onClick={() => router.push('/app/users')}
              >
                Gestionar Usuarios
              </Button>
            )}
          </div>
        </Card>
      )}
        </>
      )}
    </div>
  );
};

export default TrueDashboardPage;






