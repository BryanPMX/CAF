'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Switch, DatePicker, Upload, message, Table, Space, Tag, Row, Col } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, BellOutlined } from '@ant-design/icons';
import { apiClient } from '../../lib/api';

const { RangePicker } = DatePicker;

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

// Simple WYSIWYG: use Antd Input.TextArea for now (can swap to Quill later)
const AdminAnnouncementsManager: React.FC = () => {
  const [data, setData] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form] = Form.useForm<Announcement>();
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/dashboard/announcements');
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
    setEditing(null);
    form.resetFields();
    setVisible(true);
  };

  const openEdit = (record: Announcement) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
    });
    setVisible(true);
  };

  const handleUploadImages = async (fileList: any[]): Promise<string[]> => {
    if (!fileList?.length) return [];
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of fileList) {
        const fd = new FormData();
        fd.append('file', file as File);
        const resp = await apiClient.post('/admin/cases/0/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        urls.push(resp.data.fileUrl || resp.data.file_url || resp.data.url);
      }
      return urls.filter(Boolean);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const values = await form.validateFields();
    const payload: Announcement = { ...values };
    // transform date range
    if ((values as any).dateRange?.length === 2) {
      payload.startAt = (values as any).dateRange[0]?.toISOString();
      payload.endAt = (values as any).dateRange[1]?.toISOString();
    } else {
      payload.startAt = null;
      payload.endAt = null;
    }
    // images already set
    if (editing?.id) {
      await apiClient.patch(`/admin/announcements/${editing.id}`, payload);
      message.success('Anuncio actualizado');
    } else {
      await apiClient.post('/admin/announcements', payload);
      message.success('Anuncio creado');
    }
    setVisible(false);
    setEditing(null);
    await load();
  };

  const remove = async (record: Announcement) => {
    await apiClient.delete(`/admin/announcements/${record.id}`);
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

      <Modal
        title={
          <div className="flex items-center">
            <BellOutlined className="mr-2 text-blue-500" />
            {editing ? 'Editar Anuncio' : 'Crear Nuevo Anuncio'}
          </div>
        }
        open={visible}
        onCancel={() => { setVisible(false); setEditing(null); }}
        onOk={submit}
        confirmLoading={uploading}
        okText={editing ? 'Guardar Cambios' : 'Crear Anuncio'}
        cancelText="Cancelar"
        width={700}
        className="announcement-modal"
      >
        <Form layout="vertical" form={form} initialValues={{ pinned: false, images: [] }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                name="title" 
                label="Título del Anuncio" 
                rules={[{ required: true, message: 'El título es requerido' }]}
              >
                <Input placeholder="Ingrese el título del anuncio..." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                name="bodyHtml" 
                label="Contenido del Anuncio" 
                rules={[{ required: true, message: 'El contenido es requerido' }]}
                extra="Puede usar HTML básico para formatear el texto"
              >
                <Input.TextArea 
                  rows={6} 
                  placeholder="<p>Escriba el contenido del anuncio aquí...</p>" 
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Imágenes del Anuncio">
                <Upload
                  multiple
                  beforeUpload={() => false}
                  customRequest={async ({ file, onSuccess, onError }: any) => {
                    try {
                      const urls = await handleUploadImages([file]);
                      const prev = form.getFieldValue('images') || [];
                      form.setFieldsValue({ images: [...prev, ...urls] });
                      onSuccess?.(urls);
                    } catch (e) {
                      onError?.(e);
                    }
                  }}
                  listType="picture-card"
                  maxCount={5}
                >
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>Subir</div>
                  </div>
                </Upload>
              </Form.Item>
              <Form.Item name="images" hidden>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pinned" label="Anuncio Fijo" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="tags" label="Etiquetas">
                <Select mode="tags" placeholder="Agregar etiquetas..." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="visibleRoles" label="Roles Visibles">
                <Select 
                  mode="multiple" 
                  placeholder="Seleccionar roles..." 
                  options={[
                    { label: 'Administrador', value: 'admin' },
                    { label: 'Personal', value: 'staff' },
                    { label: 'Abogado', value: 'lawyer' },
                    { label: 'Cliente', value: 'client' },
                    { label: 'Gerente de Oficina', value: 'office_manager' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visibleDepartments" label="Departamentos Visibles">
                <Select 
                  mode="multiple" 
                  placeholder="Seleccionar departamentos..." 
                  options={[
                    { label: 'Familiar', value: 'Familiar' },
                    { label: 'Civil', value: 'Civil' },
                    { label: 'Psicología', value: 'Psicologia' },
                    { label: 'Recursos', value: 'Recursos' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="dateRange" label="Período de Vigencia">
                <RangePicker 
                  showTime 
                  placeholder={['Fecha de inicio', 'Fecha de fin']}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
};

export default AdminAnnouncementsManager;


