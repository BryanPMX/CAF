// admin-portal/src/app/(dashboard)/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Spin, message } from 'antd';
import { ScheduleOutlined, FolderOpenOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { apiClient } from '../lib/api';

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
        // UPDATED: This now calls the real API endpoint we created.
        const response = await apiClient.get('/admin/dashboard-summary');
        setSummaryData(response.data);
      } catch (error) {
        message.error('No se pudo cargar el resumen del dashboard.');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch data if a user role is confirmed.
    if (role) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" tip="Cargando resumen..." /></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {/* Conditionally render the correct dashboard based on the user's role */}
      {userRole === 'admin' && summaryData && <AdminDashboard data={summaryData} />}
      {userRole !== 'admin' && summaryData && <StaffDashboard data={summaryData} />}
    </div>
  );
};

export default TrueDashboardPage;






