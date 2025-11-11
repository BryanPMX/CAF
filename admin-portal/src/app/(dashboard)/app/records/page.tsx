'use client';

import React, { useState, useEffect } from 'react';
import { CASE_STATUSES, CASE_STATUS_DISPLAY_NAMES } from '@/config/statuses';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Select, 
  Pagination, 
  Statistic, 
  Row, 
  Col, 
  Modal, 
  message, 
  Popconfirm, 
  Typography, 
  Result,
  Tabs,
  Spin,
  Tooltip
} from 'antd';
import { 
  SearchOutlined, 
  UndoOutlined, 
  DeleteOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined, 
  DeleteFilled, 
  EyeOutlined,
  CalendarOutlined,
  UserOutlined,
  BankOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/app/lib/api';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import { useAuth } from '@/context/AuthContext';
import { RecordService } from '@/services';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface ArchiveStats {
  totalArchived: number;
  completedArchived: number;
  manuallyDeleted: number;
  thisMonth: number;
  lastMonth: number;
}

interface ArchivedCase {
  id: number;
  title: string;
  docketNumber: string;
  court: string;
  status: string;
  isCompleted: boolean;
  isArchived: boolean;
  archiveReason: string;
  archivedAt: string;
  archivedBy: number;
  completedAt?: string;
  completedBy?: number;
  completionNote?: string;
  client?: {
    firstName: string;
    lastName: string;
  };
  office?: {
    name: string;
  };
  primaryStaff?: {
    firstName: string;
    lastName: string;
  };
}

interface ArchivedAppointment {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  isArchived: boolean;
  archiveReason: string;
  archivedAt: string;
  archivedBy: number;
  client?: {
    firstName: string;
    lastName: string;
  };
  office?: {
    name: string;
  };
  staff?: {
    firstName: string;
    lastName: string;
  };
}

const RecordsPage: React.FC = () => {
  const router = useRouter();
  const isHydrated = useHydrationSafe();
  const { user } = useAuth();
  const [cases, setCases] = useState<ArchivedCase[]>([]);
  const [appointments, setAppointments] = useState<ArchivedAppointment[]>([]);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [archiveType, setArchiveType] = useState<'all' | 'completed' | 'deleted'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState('cases');

  // Check user role and access permissions
  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration to complete
    
    const checkAccess = () => {
      if (!user?.role) {
        setLoading(false);
        return false;
      }
      
      setUserRole(user.role);

      // Only admins and office managers can access archives
      if (user.role !== 'admin' && user.role !== 'office_manager') {
        setAccessDenied(true);
        setLoading(false);
        return false;
      }
      return true;
    };

    if (!checkAccess()) {
      return;
    }

    // Load initial data
    loadStats();
    loadCases(searchText, archiveType);
  }, [isHydrated, user]);

  // Load archive statistics
  const loadStats = async () => {
    try {
      // Wait for user to be loaded before fetching
      if (!user?.role) {
        console.log('User role not yet loaded, skipping stats fetch');
        return;
      }

      const data = await RecordService.fetchStats(user.role);
      setStats(data);
    } catch (error) {
      console.error('Error loading archive stats:', error);
      message.error('Error al cargar estadísticas de archivos');
    }
  };

  // Load archived cases
  const loadCases = async (searchText?: string, archiveType?: string) => {
    try {
      // Wait for user to be loaded before fetching
      if (!user?.role) {
        console.log('User role not yet loaded, skipping cases fetch');
        setLoadingCases(false);
        setLoading(false);
        return;
      }

      setLoadingCases(true);
      const data = await RecordService.fetchArchivedCases(user.role, {
        page: currentPage,
        limit: 20,
        type: archiveType || 'all',
        search: searchText || '',
      });

      setCases(data.cases);
      setTotalPages(data.pagination.pages);
      setTotalItems(data.pagination.total);
    } catch (error) {
      console.error('Error loading archived cases:', error);
      message.error('Error al cargar casos archivados');
    } finally {
      setLoadingCases(false);
      setLoading(false);
    }
  };

  // Load archived appointments
  const loadAppointments = async (searchText?: string, archiveType?: string) => {
    try {
      // Wait for user to be loaded before fetching
      if (!user?.role) {
        console.log('User role not yet loaded, skipping appointments fetch');
        setLoadingAppointments(false);
        return;
      }

      setLoadingAppointments(true);
      const data = await RecordService.fetchArchivedAppointments(user.role, {
        page: currentPage,
        limit: 20,
        type: archiveType || 'all',
        search: searchText || '',
      });

      setAppointments(data.appointments);
      setTotalPages(data.pagination.pages);
      setTotalItems(data.pagination.total);
    } catch (error) {
      console.error('Error loading archived appointments:', error);
      message.error('Error al cargar citas archivadas');
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Handle tab change
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setCurrentPage(1);
    if (key === 'cases') {
      loadCases(searchText, archiveType);
    } else {
      loadAppointments(searchText, archiveType);
    }
  };

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    if (activeTab === 'cases') {
      loadCases(searchText, archiveType);
    } else {
      loadAppointments(searchText, archiveType);
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (activeTab === 'cases') {
      loadCases(searchText, archiveType);
    } else {
      loadAppointments(searchText, archiveType);
    }
  };

  // Restore archived case
  const handleRestoreCase = async (caseId: number) => {
    try {
      await apiClient.post(`/admin/records/cases/${caseId}/restore`);
      message.success('Caso restaurado exitosamente');
      loadCases();
      loadStats();
    } catch (error) {
      console.error('Error restoring case:', error);
      message.error('Error al restaurar el caso');
    }
  };

  // Permanently delete archived case
  const handleDeleteCase = async (caseId: number) => {
    try {
      await apiClient.delete(`/admin/records/cases/${caseId}`);
      message.success('Caso eliminado permanentemente');
      loadCases();
      loadStats();
    } catch (error) {
      console.error('Error deleting case:', error);
      message.error('Error al eliminar el caso');
    }
  };

  // Restore archived appointment
  const handleRestoreAppointment = async (appointmentId: number) => {
    try {
      await apiClient.post(`/admin/records/appointments/${appointmentId}/restore`);
      message.success('Cita restaurada exitosamente');
      loadAppointments();
      loadStats();
    } catch (error) {
      console.error('Error restoring appointment:', error);
      message.error('Error al restaurar la cita');
    }
  };

  // Permanently delete archived appointment
  const handleDeleteAppointment = async (appointmentId: number) => {
    try {
      await apiClient.delete(`/admin/records/appointments/${appointmentId}`);
      message.success('Cita eliminada permanentemente');
      loadAppointments();
      loadStats();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      message.error('Error al eliminar la cita');
    }
  };

  // Cases table columns
  const casesColumns = [
    {
      title: 'Número de Expediente',
      dataIndex: 'docketNumber',
      key: 'docketNumber',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'Tribunal',
      dataIndex: 'court',
      key: 'court',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'Cliente',
      key: 'client',
      render: (record: ArchivedCase) => (
        <Text>
          {record.client ? `${record.client.firstName} ${record.client.lastName}` : 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Oficina',
      key: 'office',
      render: (record: ArchivedCase) => (
        <Text>
          {record.office ? record.office.name : 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ArchivedCase) => (
        <Space direction="vertical" size="small">
          <Tag color={record.isCompleted ? 'green' : 'blue'}>
            {record.isCompleted ? 'Completado' : 'En Proceso'}
          </Tag>
          <Tag color="orange">Archivado</Tag>
        </Space>
      ),
    },
    {
      title: 'Razón de Archivo',
      dataIndex: 'archiveReason',
      key: 'archiveReason',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'Fecha de Archivo',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      render: (text: string) => <Text>{new Date(text).toLocaleDateString('es-ES')}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (record: ArchivedCase) => (
        <Space>
          <Tooltip title="Ver detalles">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/app/cases/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="¿Restaurar caso?"
            description="¿Está seguro de que desea restaurar este caso? Volverá a estar activo."
            onConfirm={() => handleRestoreCase(record.id)}
            okText="Sí"
            cancelText="No"
          >
            <Tooltip title="Restaurar">
              <Button
                type="primary"
                icon={<UndoOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="¿Eliminar permanentemente?"
            description="Esta acción no se puede deshacer. El caso será eliminado permanentemente."
            onConfirm={() => handleDeleteCase(record.id)}
            okText="Sí"
            cancelText="No"
            okType="danger"
          >
            <Tooltip title="Eliminar permanentemente">
              <Button
                type="primary"
                danger
                icon={<DeleteFilled />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Appointments table columns
  const appointmentsColumns = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <Text>{text || 'N/A'}</Text>,
    },
    {
      title: 'Fecha y Hora',
      key: 'datetime',
      render: (record: ArchivedAppointment) => (
        <Space direction="vertical" size="small">
          <Text>{new Date(record.startTime).toLocaleDateString('es-ES')}</Text>
          <Text type="secondary">
            {new Date(record.startTime).toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })} - {new Date(record.endTime).toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Cliente',
      key: 'client',
      render: (record: ArchivedAppointment) => (
        <Text>
          {record.client ? `${record.client.firstName} ${record.client.lastName}` : 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Oficina',
      key: 'office',
      render: (record: ArchivedAppointment) => (
        <Text>
          {record.office ? record.office.name : 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color="orange">Archivado</Tag>
      ),
    },
    {
      title: 'Razón de Archivo',
      dataIndex: 'archiveReason',
      key: 'archiveReason',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'Fecha de Archivo',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      render: (text: string) => <Text>{new Date(text).toLocaleDateString('es-ES')}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (record: ArchivedAppointment) => (
        <Space>
          <Popconfirm
            title="¿Restaurar cita?"
            description="¿Está seguro de que desea restaurar esta cita? Volverá a estar activa."
            onConfirm={() => handleRestoreAppointment(record.id)}
            okText="Sí"
            cancelText="No"
          >
            <Tooltip title="Restaurar">
              <Button
                type="primary"
                icon={<UndoOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="¿Eliminar permanentemente?"
            description="Esta acción no se puede deshacer. La cita será eliminada permanentemente."
            onConfirm={() => handleDeleteAppointment(record.id)}
            okText="Sí"
            cancelText="No"
            okType="danger"
          >
            <Tooltip title="Eliminar permanentemente">
              <Button
                type="primary"
                danger
                icon={<DeleteFilled />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Show access denied if user doesn't have permission
  if (accessDenied) {
    return (
      <Result
        status="403"
        title="Acceso Denegado"
        subTitle="No tiene permisos para acceder a esta sección. Solo administradores y gerentes de oficina pueden acceder a los archivos."
        extra={
          <Button type="primary" onClick={() => router.push('/')}>
            Volver al Dashboard
          </Button>
        }
      />
    );
  }

  // Show loading spinner
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Cargando archivos...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>
          <FileTextOutlined style={{ marginRight: '8px' }} />
          Archivos
        </Title>
        
        {/* Statistics Row */}
        {stats && (
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Archivado"
                  value={stats.totalArchived}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Completados Archivados"
                  value={stats.completedArchived}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Eliminados Manualmente"
                  value={stats.manuallyDeleted}
                  prefix={<DeleteOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Este Mes"
                  value={stats.thisMonth}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Search and Filter Controls */}
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={12}>
            <Input
              placeholder="Buscar por número de expediente, título, cliente..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col span={8}>
            <Select
              value={archiveType}
              onChange={setArchiveType}
              style={{ width: '100%' }}
            >
              <Option value="all">Todos los archivos</Option>
              <Option value="completed">Completados</Option>
              <Option value="deleted">Eliminados manualmente</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button type="primary" onClick={handleSearch} block>
              Buscar
            </Button>
          </Col>
        </Row>

        {/* Tabs for Cases and Appointments */}
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane 
            tab={
              <span>
                <FileTextOutlined />
                Casos Archivados
              </span>
            } 
            key="cases"
          >
            <Table
              columns={casesColumns}
              dataSource={cases}
              rowKey="id"
              loading={loadingCases}
              pagination={false}
              scroll={{ x: 1200 }}
            />
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Pagination
                current={currentPage}
                total={totalItems}
                pageSize={20}
                onChange={handlePageChange}
                showSizeChanger={false}
                showQuickJumper
                showTotal={(total, range) => 
                  `${range[0]}-${range[1]} de ${total} casos`
                }
              />
            </div>
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <CalendarOutlined />
                Citas Archivadas
              </span>
            } 
            key="appointments"
          >
            <Table
              columns={appointmentsColumns}
              dataSource={appointments}
              rowKey="id"
              loading={loadingAppointments}
              pagination={false}
              scroll={{ x: 1200 }}
            />
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Pagination
                current={currentPage}
                total={totalItems}
                pageSize={20}
                onChange={handlePageChange}
                showSizeChanger={false}
                showQuickJumper
                showTotal={(total, range) => 
                  `${range[0]}-${range[1]} de ${total} citas`
                }
              />
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default RecordsPage;
