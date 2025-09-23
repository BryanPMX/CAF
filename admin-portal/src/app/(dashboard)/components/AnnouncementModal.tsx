'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Select, Switch, DatePicker, Upload, Button, Row, Col, message } from 'antd';
import { BellOutlined, UploadOutlined } from '@ant-design/icons';
import { STAFF_ROLES, getAllRoles } from '@/config/roles';
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

interface AnnouncementFormData extends Omit<Announcement, 'startAt' | 'endAt'> {
  dateRange?: [Date, Date] | undefined;
}

interface AnnouncementModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  editingAnnouncement?: Announcement | null;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  editingAnnouncement
}) => {
  const [form] = Form.useForm<AnnouncementFormData>();
  const [uploading, setUploading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const handleUploadImages = async (fileList: any[]): Promise<string[]> => {
    if (!fileList?.length) return [];
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of fileList) {
        const fd = new FormData();
        fd.append('file', file as File);
        const resp = await apiClient.post('/admin/cases/0/documents', fd, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });
        urls.push(resp.data.fileUrl || resp.data.file_url || resp.data.url);
      }
      return urls.filter(Boolean);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);

      const payload: Announcement = { ...values };
      
      // Transform date range
      if (values.dateRange?.length === 2) {
        payload.startAt = values.dateRange[0]?.toISOString();
        payload.endAt = values.dateRange[1]?.toISOString();
      } else {
        payload.startAt = null;
        payload.endAt = null;
      }

      if (editingAnnouncement?.id) {
        await apiClient.patch(`/admin/announcements/${editingAnnouncement.id}`, payload);
        message.success('Anuncio actualizado correctamente');
      } else {
        await apiClient.post('/admin/announcements', payload);
        message.success('Anuncio creado correctamente');
      }

      form.resetFields();
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting announcement:', error);
      message.error(error.response?.data?.error || 'Error al procesar el anuncio');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // Set form values when editing
  React.useEffect(() => {
    if (visible && editingAnnouncement) {
      form.setFieldsValue({
        ...editingAnnouncement,
        dateRange: editingAnnouncement.startAt && editingAnnouncement.endAt 
          ? [new Date(editingAnnouncement.startAt), new Date(editingAnnouncement.endAt)]
          : undefined
      });
    } else if (visible && !editingAnnouncement) {
      form.resetFields();
      form.setFieldsValue({ pinned: false, images: [] });
    }
  }, [visible, editingAnnouncement, form]);

  return (
    <Modal
      title={
        <div className="flex items-center">
          <BellOutlined className="mr-2 text-blue-500" />
          {editingAnnouncement ? 'Editar Anuncio' : 'Crear Nuevo Anuncio'}
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={confirmLoading}
      okText={editingAnnouncement ? 'Guardar Cambios' : 'Crear Anuncio'}
      cancelText="Cancelar"
      width={700}
      className="announcement-modal"
      destroyOnClose
    >
      <Form 
        layout="vertical" 
        form={form} 
        initialValues={{ pinned: false, images: [] }}
        preserve={false}
      >
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
                disabled={uploading}
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
                options={getAllRoles().map(role => ({ label: role.spanishName, value: role.key }))}
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
  );
};

export default AnnouncementModal;
