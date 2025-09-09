'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card, message, Table, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BellOutlined } from '@ant-design/icons';
import { apiClient } from '../../lib/api';
import AnnouncementModal from './AnnouncementModal';

interface Announcement {
  id?: number;
  title: string;
  bodyHtml: string;
  images?: string[];
  tags?: string[];
  pinned?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  visibleRoles?: string[];
  visibleDepartments?: string[];
}

const AdminAnnouncementsManager: React.FC = () => {
  const [data, setData] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/dashboard/announcements');
      setData(res.data.announcements || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
      // If announcements fail to load, just show empty state
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingAnnouncement(null);
    setModalVisible(true);
  };

  const openEdit = (record: Announcement) => {
    setEditingAnnouncement(record);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditingAnnouncement(null);
    load();
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingAnnouncement(null);
  };

  const remove = async (record: Announcement) => {
    await apiClient.delete(`/api/v1/admin/announcements/${record.id}`);
    message.success('Anuncio eliminado');
    await load();
  };

  const columns = [
    { title: 'Título', dataIndex: 'title' },
    { title: 'Fijado', dataIndex: 'pinned', render: (v: boolean) => v ? <Tag color="gold">Fijado</Tag> : '-' },
    { title: 'Roles', dataIndex: 'visibleRoles', render: (r: string[]) => (r || []).join(', ') },
    { title: 'Deptos', dataIndex: 'visibleDepartments', render: (r: string[]) => (r || []).join(', ') },
    {
      title: 'Acciones',
      render: (_: any, rec: Announcement) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(rec)} />
          <Button icon={<DeleteOutlined />} danger onClick={() => remove(rec)} />
        </Space>
      )
    }
  ];

  return (
    <Card 
      title={
        <div className="flex items-center">
          <BellOutlined className="mr-2 text-blue-500" />
          <span>Gestionar Anuncios del Sistema</span>
        </div>
      } 
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={openCreate}
          size="large"
        >
          Crear Nuevo Anuncio
        </Button>
      }
      className="shadow-lg border-2 border-blue-100"
    >
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <div className="text-blue-800">
          <strong>💡 Consejo:</strong> Los anuncios son visibles para todos los usuarios del sistema. 
          Use etiquetas y roles para controlar la visibilidad de cada anuncio.
        </div>
      </div>

      <Table 
        rowKey="id" 
        columns={columns as any} 
        dataSource={data} 
        loading={loading} 
        pagination={{ pageSize: 10 }}
        className="mb-4"
      />

      <AnnouncementModal
        visible={modalVisible}
        onCancel={handleModalCancel}
        onSuccess={handleModalSuccess}
        editingAnnouncement={editingAnnouncement}
      />
    </Card>
  );
};

export default AdminAnnouncementsManager;


