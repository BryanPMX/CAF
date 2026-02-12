// admin-portal/src/app/(dashboard)/app/offices/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button, Table, message, Spin, Popconfirm, Drawer, Descriptions, Tag, List, Avatar, Card, Statistic, Row, Col, Typography, Space, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, UserOutlined, BankOutlined, PhoneOutlined, EnvironmentOutlined, MailOutlined, FolderOpenOutlined, CalendarOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import OfficeModal from './components/OfficeModal';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import { useAuth } from '@/context/AuthContext';
import { OfficeService } from '@/services';
import { getRoleDisplayName } from '@/config/roles';

const { Text, Title } = Typography;

interface Office {
  id: number;
  name: string;
  address: string;
  phoneOffice?: string;
  phoneCell?: string;
  code?: string;
}

interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  isActive: boolean;
}

interface OfficeDetail {
  office: Office;
  staff: StaffMember[];
  activeCases: number;
  totalAppointments: number;
  staffCount: number;
  clientCount?: number;
}

// Role color mapping for consistent badges
const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  office_manager: 'blue',
  lawyer: 'green',
  psychologist: 'purple',
  receptionist: 'orange',
  event_coordinator: 'gold',
  client: 'default',
};

const OfficeManagementPage = () => {
  const isHydrated = useHydrationSafe();
  const { user } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Detail drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<OfficeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchOffices = async () => {
    try {
      if (!user?.role) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await OfficeService.fetchOffices(user.role);
      setOffices(data);
    } catch (error) {
      message.error('No se pudieron cargar las oficinas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isHydrated) return;
    
    if (user?.role) {
      setUserRole(user.role);
    }
    fetchOffices();
  }, [isHydrated, user]);

  const handleCreate = () => {
    setEditingOffice(null);
    setIsModalVisible(true);
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
    setIsModalVisible(true);
  };

  const handleDelete = async (officeId: number) => {
    try {
      if (!user?.role) {
        message.error('Usuario no autenticado');
        return;
      }

      message.loading({ content: 'Eliminando...', key: 'deleteOffice' });
      await OfficeService.deleteOffice(user.role, officeId.toString());
      message.success({ content: 'Oficina eliminada exitosamente.', key: 'deleteOffice' });
      fetchOffices();
    } catch (error) {
      message.error({ content: 'No se pudo eliminar la oficina.', key: 'deleteOffice' });
    }
  };

  // Fetch office detail with staff
  const handleViewDetail = async (office: Office) => {
    setDrawerVisible(true);
    setLoadingDetail(true);
    try {
      const base = user?.role === 'office_manager' ? '/manager' : '/admin';
      const response = await apiClient.get(`${base}/offices/${office.id}/detail`);
      setSelectedOffice(response.data);
    } catch (error) {
      // Fallback: show office info without staff
      setSelectedOffice({
        office,
        staff: [],
        activeCases: 0,
        totalAppointments: 0,
        staffCount: 0,
        clientCount: 0,
      });
      console.error('Failed to load office detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Office) => (
        <Button type="link" onClick={() => handleViewDetail(record)} style={{ padding: 0, fontWeight: 600 }}>
          {text}
        </Button>
      ),
    },
    { title: 'Dirección', dataIndex: 'address', key: 'address' },
    {
      title: 'Teléfono',
      key: 'phone',
      render: (_: any, record: Office) => (
        <Space direction="vertical" size={0}>
          {record.phoneOffice && <Text><PhoneOutlined /> {record.phoneOffice}</Text>}
          {record.phoneCell && <Text type="secondary">{record.phoneCell}</Text>}
          {!record.phoneOffice && !record.phoneCell && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 200,
      render: (_: any, record: Office) => (
        <Space>
          <Button size="small" onClick={() => handleViewDetail(record)}>
            Ver Detalle
          </Button>
          {userRole === 'admin' && (
            <>
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
              <Popconfirm
                title="Eliminar oficina"
                description="La oficina se borrará de forma permanente. Esta acción no se puede deshacer. ¿Continuar?"
                onConfirm={() => handleDelete(record.id)}
                okText="Sí, eliminar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
              >
                <Button icon={<DeleteOutlined />} danger size="small" />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Oficinas</h1>
          <Text type="secondary">Haga clic en el nombre de una oficina para ver su detalle y personal</Text>
        </div>
        {userRole === 'admin' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Crear Oficina
          </Button>
        )}
      </div>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={offices}
          rowKey="id"
          locale={{ emptyText: 'No hay oficinas registradas.' }}
        />
      </Spin>

      {/* Office Detail Drawer */}
      <Drawer
        title={
          <Space>
            <BankOutlined />
            <span>{selectedOffice?.office?.name || 'Detalle de Oficina'}</span>
          </Space>
        }
        placement="right"
        width={520}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedOffice(null);
        }}
      >
        {loadingDetail ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="Cargando detalle..." />
          </div>
        ) : selectedOffice ? (
          <div className="space-y-6">
            {/* Office Stats */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Personal"
                    value={selectedOffice.staffCount ?? 0}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Clientes"
                    value={selectedOffice.clientCount ?? 0}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Casos Activos"
                    value={selectedOffice.activeCases ?? 0}
                    prefix={<FolderOpenOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="Citas"
                    value={selectedOffice.totalAppointments ?? 0}
                    prefix={<CalendarOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Office Information */}
            <Card title="Información de la Oficina" size="small">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={<><BankOutlined /> Nombre</>}>
                  {selectedOffice.office.name}
                </Descriptions.Item>
                <Descriptions.Item label={<><EnvironmentOutlined /> Dirección</>}>
                  {selectedOffice.office.address || 'No especificada'}
                </Descriptions.Item>
                {selectedOffice.office.phoneOffice && (
                  <Descriptions.Item label={<><PhoneOutlined /> Teléfono Oficina</>}>
                    {selectedOffice.office.phoneOffice}
                  </Descriptions.Item>
                )}
                {selectedOffice.office.phoneCell && (
                  <Descriptions.Item label={<><PhoneOutlined /> Celular</>}>
                    {selectedOffice.office.phoneCell}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Staff List */}
            <Card
              title={
                <Space>
                  <TeamOutlined />
                  <span>Personal ({selectedOffice.staffCount})</span>
                </Space>
              }
              size="small"
            >
              {selectedOffice.staff.length > 0 ? (
                <List
                  dataSource={selectedOffice.staff}
                  renderItem={(member: StaffMember) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{
                              backgroundColor: member.isActive ? '#1890ff' : '#d9d9d9',
                            }}
                          >
                            {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                          </Avatar>
                        }
                        title={
                          <Space>
                            <span>{member.firstName} {member.lastName}</span>
                            <Tag color={ROLE_COLORS[member.role] || 'default'} style={{ fontSize: 11 }}>
                              {getRoleDisplayName(member.role)}
                            </Tag>
                            {!member.isActive && <Tag color="red">Inactivo</Tag>}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary"><MailOutlined /> {member.email}</Text>
                            {member.phone && <Text type="secondary"><PhoneOutlined /> {member.phone}</Text>}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No hay personal asignado a esta oficina" />
              )}
            </Card>
          </div>
        ) : null}
      </Drawer>

      <OfficeModal
        key={editingOffice ? `edit-${editingOffice.id}` : 'new'}
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={fetchOffices}
        office={editingOffice}
      />
    </div>
  );
};

export default OfficeManagementPage;
