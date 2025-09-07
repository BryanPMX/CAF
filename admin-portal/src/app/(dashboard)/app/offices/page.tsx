// admin-portal/src/app/(dashboard)/admin/offices/page.tsx (New File)
'use client';

import React, { useState, useEffect } from 'react';
import { Button, Table, message, Spin, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import OfficeModal from './components/OfficeModal';

interface Office {
  id: number;
  name: string;
  address: string;
}

const OfficeManagementPage = () => {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchOffices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/offices');
      setOffices(response.data);
    } catch (error) {
      message.error('No se pudieron cargar las oficinas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get user role for RBAC
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
    setUserRole(role);
    fetchOffices();
  }, []);

  const handleCreate = () => {
    setEditingOffice(null); // Ensure we are in "create" mode
    setIsModalVisible(true);
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office); // Set the office to edit
    setIsModalVisible(true);
  };

  const handleDelete = async (officeId: number) => {
    try {
      message.loading({ content: 'Eliminando...', key: 'deleteOffice' });
      await apiClient.delete(`/admin/offices/${officeId}`);
      message.success({ content: 'Oficina eliminada exitosamente.', key: 'deleteOffice' });
      fetchOffices(); // Refresh the list
    } catch (error) {
      message.error({ content: 'No se pudo eliminar la oficina.', key: 'deleteOffice' });
    }
  };

  const columns = [
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Dirección', dataIndex: 'address', key: 'address' },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Office) => (
        userRole === 'admin' ? (
          <span className="space-x-2">
            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              Editar
            </Button>
            <Popconfirm
              title="¿Está seguro de que desea eliminar esta oficina?"
              onConfirm={() => handleDelete(record.id)}
              okText="Sí"
              cancelText="No"
            >
              <Button icon={<DeleteOutlined />} danger>
                Eliminar
              </Button>
            </Popconfirm>
          </span>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Oficinas</h1>
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
      <OfficeModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={fetchOffices}
        office={editingOffice}
      />
    </div>
  );
};

export default OfficeManagementPage;