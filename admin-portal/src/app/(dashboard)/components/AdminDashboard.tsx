'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  message, 
  Tooltip, 
  Badge,
  Avatar,
  List,
  Timeline,
  Calendar,
  Tabs,
  Dropdown,
  Menu,
  Divider,
  Switch,
  Alert,
  Skeleton
} from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  DollarOutlined,
  RiseOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  SettingOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  FilterOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  BellOutlined,
  TeamOutlined,
  BankOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { Line, Bar, Pie, Area } from '@ant-design/plots';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { Option } = Select;

interface DashboardStats {
  totalUsers: number;
  totalAppointments: number;
  totalCases: number;
  totalOffices: number;
  activeUsers: number;
  pendingAppointments: number;
  completedCases: number;
  revenue: number;
  growthRate: number;
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

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  storage: 'healthy' | 'warning' | 'error';
  uptime: number;
  lastBackup: string;
  activeConnections: number;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, activityRes, healthRes] = await Promise.all([
        apiClient.get('/admin/dashboard/stats'),
        apiClient.get('/admin/dashboard/activity'),
        apiClient.get('/admin/dashboard/health')
      ]);

      setStats(statsRes.data);
      setRecentActivity(activityRes.data);
      setSystemHealth(healthRes.data);
    } catch (error) {
      message.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkOperation = async (operation: string) => {
    if (selectedItems.length === 0) {
      message.warning('Please select items first');
      return;
    }

    try {
      await apiClient.post('/admin/bulk-operations', {
        operation,
        items: selectedItems
      });
      message.success(`Bulk ${operation} completed successfully`);
      setBulkModalVisible(false);
      setSelectedItems([]);
      fetchDashboardData();
    } catch (error) {
      message.error(`Failed to perform bulk ${operation}`);
    }
  };

  const handleExport = async (format: string) => {
    try {
      const response = await apiClient.post('/admin/export', {
        format,
        dateRange,
        filters: {}
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `caf-export-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setExportModalVisible(false);
      message.success('Export completed successfully');
    } catch (error) {
      message.error('Export failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'appointment': return <CalendarOutlined />;
      case 'case': return <FileTextOutlined />;
      case 'user': return <UserOutlined />;
      case 'system': return <SettingOutlined />;
      default: return <ExclamationCircleOutlined />;
    }
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <div className="admin-dashboard p-6">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back! Here&apos;s what&apos;s happening with your system.</p>
          </div>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchDashboardData}
              loading={loading}
            >
              Refresh
            </Button>
            <Button 
              type="primary" 
              icon={<ExportOutlined />}
              onClick={() => setExportModalVisible(true)}
            >
              Export Data
            </Button>
            <Button 
              icon={<SettingOutlined />}
            >
              Settings
            </Button>
          </Space>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                size="large"
              >
                New Appointment
              </Button>
              <Button 
                icon={<UserOutlined />}
                size="large"
              >
                Add User
              </Button>
              <Button 
                icon={<BankOutlined />}
                size="large"
              >
                New Office
              </Button>
              <Button 
                icon={<FileTextOutlined />}
                size="large"
              >
                Create Case
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button 
                icon={<FilterOutlined />}
                onClick={() => setBulkModalVisible(true)}
              >
                Bulk Operations
              </Button>
              <Button 
                icon={<UploadOutlined />}
              >
                Import Data
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats?.totalUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
            <Progress 
              percent={stats ? (stats.activeUsers / stats.totalUsers) * 100 : 0} 
              size="small" 
              className="mt-2"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Appointments"
              value={stats?.totalAppointments || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Progress 
              percent={stats ? (stats.pendingAppointments / stats.totalAppointments) * 100 : 0} 
              size="small" 
              className="mt-2"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Cases"
              value={stats?.totalCases || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Progress 
              percent={stats ? (stats.completedCases / stats.totalCases) * 100 : 0} 
              size="small" 
              className="mt-2"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Revenue"
              value={stats?.revenue || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="USD"
            />
            <div className="flex items-center mt-2">
              <RiseOutlined className="text-green-500 mr-1" />
              <span className="text-green-500">{stats?.growthRate || 0}%</span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Tabs defaultActiveKey="overview" className="mb-6">
        <TabPane tab="Overview" key="overview">
          <Row gutter={[16, 16]}>
            {/* System Health */}
            <Col xs={24} lg={8}>
              <Card title="System Health" className="h-full">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Database</span>
                    <Badge 
                      status={getStatusColor(systemHealth?.database || 'healthy')} 
                      text={systemHealth?.database || 'healthy'} 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>API Service</span>
                    <Badge 
                      status={getStatusColor(systemHealth?.api || 'healthy')} 
                      text={systemHealth?.api || 'healthy'} 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Storage</span>
                    <Badge 
                      status={getStatusColor(systemHealth?.storage || 'healthy')} 
                      text={systemHealth?.storage || 'healthy'} 
                    />
                  </div>
                  <Divider />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {systemHealth?.uptime || 0}%
                    </div>
                    <div className="text-gray-500">System Uptime</div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Enhanced Insights Panel */}
            <Col xs={24} lg={16}>
              <Card title="Insights y Recomendaciones" className="h-full">
                <div className="space-y-4">
                  {/* Performance Insights */}
                  <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-l-blue-500">
                    <div className="font-medium text-blue-800 mb-2">📊 Rendimiento del Sistema</div>
                    <div className="text-blue-700 text-sm">
                      {stats && stats.totalCases > 0 ? (
                        <div>El sistema está procesando {stats.totalCases} casos activos con una tasa de crecimiento del {stats.growthRate}%</div>
                      ) : (
                        <div>No hay casos activos en el sistema</div>
                      )}
                    </div>
                  </div>

                  {/* Appointment Insights */}
                  <div className="p-3 bg-green-50 rounded-lg border-l-4 border-l-green-500">
                    <div className="font-medium text-green-800 mb-2">📅 Gestión de Citas</div>
                    <div className="text-green-700 text-sm">
                      {stats && stats.pendingAppointments > 0 ? (
                        <div>Hay {stats.pendingAppointments} citas pendientes que requieren atención</div>
                      ) : (
                        <div>Todas las citas están al día</div>
                      )}
                    </div>
                  </div>

                  {/* User Activity Insights */}
                  <div className="p-3 bg-purple-50 rounded-lg border-l-4 border-l-purple-500">
                    <div className="font-medium text-purple-800 mb-2">👥 Actividad de Usuarios</div>
                    <div className="text-purple-700 text-sm">
                      {stats && stats.activeUsers > 0 ? (
                        <div>{stats.activeUsers} de {stats.totalUsers} usuarios están activos ({Math.round((stats.activeUsers / stats.totalUsers) * 100)}%)</div>
                      ) : (
                        <div>No hay usuarios activos en el sistema</div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-2">
                    <div className="text-sm text-gray-600 mb-2">Acciones Rápidas:</div>
                    <Space wrap>
                      <Button size="small" icon={<BarChartOutlined />}>Ver Reportes</Button>
                      <Button size="small" icon={<UserOutlined />}>Gestionar Usuarios</Button>
                      <Button size="small" icon={<BellOutlined />}>Anuncios</Button>
                    </Space>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="Analytics" key="analytics">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="User Growth Trend">
                <Line
                  data={[
                    { month: 'Jan', users: 120 },
                    { month: 'Feb', users: 150 },
                    { month: 'Mar', users: 180 },
                    { month: 'Apr', users: 220 },
                    { month: 'May', users: 280 },
                    { month: 'Jun', users: 320 }
                  ]}
                  xField="month"
                  yField="users"
                  smooth
                  point={{
                    size: 5,
                    shape: 'diamond',
                  }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Appointment Distribution">
                <Pie
                  data={[
                    { type: 'Completed', value: 65 },
                    { type: 'Pending', value: 20 },
                    { type: 'Cancelled', value: 15 }
                  ]}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  label={{
                    type: 'outer',
                    content: '{name} {percentage}',
                  }}
                />
              </Card>
            </Col>
            <Col xs={24}>
              <Card title="Revenue Analytics">
                <Area
                  data={[
                    { month: 'Jan', revenue: 15000 },
                    { month: 'Feb', revenue: 18000 },
                    { month: 'Mar', revenue: 22000 },
                    { month: 'Apr', revenue: 25000 },
                    { month: 'May', revenue: 30000 },
                    { month: 'Jun', revenue: 35000 }
                  ]}
                  xField="month"
                  yField="revenue"
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="Management" key="management">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Quick Actions">
                <div className="space-y-3">
                  <Button block icon={<UserOutlined />} size="large">
                    Manage Users
                  </Button>
                  <Button block icon={<BankOutlined />} size="large">
                    Manage Offices
                  </Button>
                  <Button block icon={<SettingOutlined />} size="large">
                    System Settings
                  </Button>
                  <Button block icon={<BellOutlined />} size="large">
                    Notifications
                  </Button>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="System Status">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Last Backup</span>
                    <span className="text-gray-600">{systemHealth?.lastBackup || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Connections</span>
                    <span className="text-gray-600">{systemHealth?.activeConnections || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto Backup</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex justify-between">
                    <span>Maintenance Mode</span>
                    <Switch />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* Bulk Operations Modal */}
      <Modal
        title="Bulk Operations"
        visible={bulkModalVisible}
        onCancel={() => setBulkModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="Select Operation">
            <Select placeholder="Choose operation type">
              <Option value="delete">Delete Selected</Option>
              <Option value="update">Update Status</Option>
              <Option value="export">Export Selected</Option>
              <Option value="archive">Archive Selected</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Target Items">
            <Select
              mode="multiple"
              placeholder="Select items to operate on"
              value={selectedItems}
              onChange={setSelectedItems}
            >
              <Option value="users">Users</Option>
              <Option value="appointments">Appointments</Option>
              <Option value="cases">Cases</Option>
              <Option value="offices">Offices</Option>
            </Select>
          </Form.Item>
          <div className="flex justify-end space-x-2">
            <Button onClick={() => setBulkModalVisible(false)}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={() => handleBulkOperation('update')}
              disabled={selectedItems.length === 0}
            >
              Execute
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Export Modal */}
      <Modal
        title="Export Data"
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form layout="vertical">
          <Form.Item label="Date Range">
            <RangePicker 
              onChange={(dates) => setDateRange(dates ? [dates[0]?.toISOString() || '', dates[1]?.toISOString() || ''] : null)}
              className="w-full"
            />
          </Form.Item>
          <Form.Item label="Export Format">
            <Select defaultValue="csv">
              <Option value="csv">CSV</Option>
              <Option value="excel">Excel</Option>
              <Option value="pdf">PDF</Option>
              <Option value="json">JSON</Option>
            </Select>
          </Form.Item>
          <div className="flex justify-end space-x-2">
            <Button onClick={() => setExportModalVisible(false)}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={() => handleExport('csv')}
            >
              Export
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
