'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Switch, DatePicker, Upload, message, Table, Space } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '../../lib/api';

const { RangePicker } = DatePicker;

interface AdminNote {
  id?: number;
  bodyText: string;
  imageUrl?: string;
  pinned?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  visibleRoles?: string[];
  visibleDepartments?: string[];
}

const AdminNotesManager: React.FC = () => {
  const [data, setData] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<AdminNote | null>(null);
  const [form] = Form.useForm<AdminNote>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/dashboard/notes');
      setData(res.data.adminNotes || []);
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

  const openEdit = (record: AdminNote) => {
    setEditing(record);
    form.setFieldsValue(record as any);
    setVisible(true);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const resp = await apiClient.post('/admin/cases/0/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return resp.data.fileUrl || resp.data.file_url || resp.data.url;
  };

  const submit = async () => {
    const values = await form.validateFields();
    const payload: AdminNote = { ...values };
    if ((values as any).dateRange?.length === 2) {
      payload.startAt = (values as any).dateRange[0]?.toISOString();
      payload.endAt = (values as any).dateRange[1]?.toISOString();
    } else {
      payload.startAt = null;
      payload.endAt = null;
    }
    if (editing?.id) {
      await apiClient.patch(`/admin/admin-notes/${editing.id}`, payload);
      message.success('Nota actualizada');
    } else {
      await apiClient.post('/admin/admin-notes', payload);
      message.success('Nota creada');
    }
    setVisible(false);
    setEditing(null);
    await load();
  };

  const remove = async (record: AdminNote) => {
    await apiClient.delete(`/admin/admin-notes/${record.id}`);
    message.success('Nota eliminada');
    await load();
  };

  const columns = [
    { title: 'Contenido', dataIndex: 'bodyText' },
    { title: 'Fijado', dataIndex: 'pinned', render: (v: boolean) => (v ? 'Sí' : 'No') },
    {
      title: 'Acciones',
      render: (_: any, rec: AdminNote) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(rec)} />
          <Button icon={<DeleteOutlined />} danger onClick={() => remove(rec)} />
        </Space>
      )
    }
  ];

  return (
    <Card title="Gestionar Notas de la Organización" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva</Button>}>
      <Table rowKey="id" columns={columns as any} dataSource={data} loading={loading} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? 'Editar Nota' : 'Nueva Nota'}
        open={visible}
        onCancel={() => { setVisible(false); setEditing(null); }}
        onOk={submit}
        okText={editing ? 'Guardar' : 'Crear'}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="bodyText" label="Contenido" rules={[{ required: true, message: 'Requerido' }]}>
            <Input.TextArea rows={5} />
          </Form.Item>

          <Form.Item label="Imagen">
            <Upload
              maxCount={1}
              beforeUpload={() => false}
              customRequest={async ({ file, onSuccess, onError }: any) => {
                try {
                  const url = await uploadImage(file as File);
                  form.setFieldsValue({ imageUrl: url });
                  onSuccess?.(url);
                } catch (e) {
                  onError?.(e);
                }
              }}
            >
              <Button icon={<UploadOutlined />}>Subir Imagen</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="imageUrl" hidden>
            <Input />
          </Form.Item>

          <Form.Item name="pinned" label="Fijar" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="visibleRoles" label="Roles visibles">
            <Select mode="tags" />
          </Form.Item>
          <Form.Item name="visibleDepartments" label="Departamentos visibles">
            <Select mode="tags" />
          </Form.Item>
          <Form.Item name="dateRange" label="Vigencia">
            <RangePicker showTime />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AdminNotesManager;


