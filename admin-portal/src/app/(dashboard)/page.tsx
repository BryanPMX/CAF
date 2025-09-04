// admin-portal/src/app/(dashboard)/page.tsx
'use client';

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Card, Col, Row, Statistic, Spin, message, Button, Space } from 'antd';
import { ScheduleOutlined, FolderOpenOutlined, TeamOutlined, CheckCircleOutlined, PlusOutlined, BellOutlined } from '@ant-design/icons';
import { apiClient } from '../lib/api';

// Lazy load heavy components
const AnnouncementsPanel = lazy(() => import('./components/AnnouncementsPanel'));
const AdminAnnouncementsManager = lazy(() => import('./components/AdminAnnouncementsManager'));

// --- TypeScript Interfaces for Data Structures ---
interface DashboardSummary {
  totalOpenCases?: number;
  totalStaff?: number;
  appointmentsToday?: number;
  // Staff-specific stats (for future use)
  myOpenCases?: number;
  myPendingTasks?: number;
  myUpcomingAppointments?: number;
}

// --- Role-Specific Dashboard Components ---
const AdminDashboard: React.FC<{ data: DashboardSummary }> = ({ data }) => (
  <Row gutter={[24, 24]}>
    <Col xs={24} sm={12} lg={8}>
      <Card hoverable>
        <Statistic title="Citas para Hoy (Todas las Oficinas)" value={data.appointmentsToday} prefix={<ScheduleOutlined />} />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={8}>
      <Card hoverable>
        <Statistic title="Casos Abiertos Totales" value={data.totalOpenCases} prefix={<FolderOpenOutlined />} />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={8}>
      <Card hoverable>
        <Statistic title="Miembros del Personal Activos" value={data.totalStaff} prefix={<TeamOutlined />} />
      </Card>
    </Col>
  </Row>
);

const StaffDashboard: React.FC<{ data: DashboardSummary }> = ({ data }) => (
  <Row gutter={[24, 24]}>
    <Col xs={24} sm={12} lg={8}>
      <Card hoverable>
        <Statistic title="Mis Próximas Citas" value={data.myUpcomingAppointments} prefix={<ScheduleOutlined />} />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={8}>
      <Card hoverable>
        <Statistic title="Mis Casos Activos" value={data.myOpenCases} prefix={<FolderOpenOutlined />} />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={8}>
      <Card hoverable>
        <Statistic title="Mis Tareas Pendientes" value={data.myPendingTasks} prefix={<CheckCircleOutlined />} />
      </Card>
    </Col>
  </Row>
);

// Loading component for lazy-loaded sections
const SectionLoading = () => (
  <div className="flex justify-center items-center h-32">
    <Spin size="large" tip="Cargando sección..." />
  </div>
);

// --- Main Page Component ---
const TrueDashboardPage = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    setUserRole(role);

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Wait a bit to ensure token is properly set after login
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify token is available before making API calls
        const token = localStorage.getItem('authToken');
        if (!token) {
          console.warn('No auth token available, skipping dashboard data fetch');
          setLoading(false);
          return;
        }
        
        // Call the universal dashboard endpoint (available to all roles)
        const response = await apiClient.get('/dashboard-summary');
        setSummaryData(response.data);
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
            }
          }, 500);
          return;
        }
        
        message.error('No se pudo cargar el resumen del dashboard.');
      } finally {
        setLoading(false);
      }
    };

    // Fetch data regardless of role - the API will handle permissions
    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" tip="Cargando resumen..." /></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => window.location.href = '/app/appointments'}
            style={{ 
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            Nueva Cita
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8">
        {userRole === 'admin' || userRole === 'office_manager' ? (
          <AdminDashboard data={summaryData || {}} />
        ) : userRole ? (
          <StaffDashboard data={summaryData || {}} />
        ) : (
          <div className="flex justify-center items-center h-32">
            <Spin size="large" tip="Cargando dashboard..." />
          </div>
        )}
      </div>

      {/* Lazy-loaded sections */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Anuncios Recientes" className="h-full">
            <Suspense fallback={<SectionLoading />}>
              <AnnouncementsPanel />
            </Suspense>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          {(userRole === 'admin' || userRole === 'office_manager') && (
            <Card title="Gestión de Anuncios" className="h-full">
              <Suspense fallback={<SectionLoading />}>
                <AdminAnnouncementsManager />
              </Suspense>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default TrueDashboardPage;






