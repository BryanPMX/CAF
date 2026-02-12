// admin-portal/src/app/(dashboard)/app/web-content/page.tsx
// CMS page for managing marketing website content.
// Tabs: Contenido General, Servicios, Eventos, Galería.
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Switch, InputNumber,
  Space, Tag, Popconfirm, message, Upload, Select, DatePicker, Typography,
  Empty, Spin, Tooltip, Row, Col, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, GlobalOutlined,
  CalendarOutlined, PictureOutlined, FileTextOutlined,
  UploadOutlined, SaveOutlined, ReloadOutlined
} from '@ant-design/icons';
import { apiClient as api } from '@/app/lib/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

// ── Types ──────────────────────────────────────
interface SiteContent {
  id: number;
  section: string;
  contentKey: string;
  contentValue: string;
  contentType: string;
  sortOrder: number;
  isActive: boolean;
}

interface SiteService {
  id?: number;
  title: string;
  description: string;
  details: string[];
  icon: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

interface SiteEvent {
  id?: number;
  title: string;
  description: string;
  eventDate: string;
  endDate?: string;
  location: string;
  imageUrl: string;
  isActive: boolean;
}

interface SiteImage {
  id?: number;
  title: string;
  altText: string;
  imageUrl: string;
  section: string;
  sortOrder: number;
  isActive: boolean;
}

// ── Main Component ─────────────────────────────
export default function WebContentPage() {
  const [activeTab, setActiveTab] = useState('content');

  return (
    <div style={{ padding: '0' }}>
      <Card
        style={{ borderRadius: 12 }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <GlobalOutlined style={{ fontSize: 24, color: '#4f46e5' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Gestión de Contenido Web</Title>
            <Text type="secondary">Administre el contenido del sitio web público</Text>
          </div>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
          <TabPane tab={<span><FileTextOutlined /> Contenido</span>} key="content">
            <ContentTab />
          </TabPane>
          <TabPane tab={<span><GlobalOutlined /> Servicios</span>} key="services">
            <ServicesTab />
          </TabPane>
          <TabPane tab={<span><CalendarOutlined /> Eventos</span>} key="events">
            <EventsTab />
          </TabPane>
          <TabPane tab={<span><PictureOutlined /> Galería</span>} key="gallery">
            <GalleryTab />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════
// CONTENT TAB - Key-value text content editor
// ══════════════════════════════════════════════
function ContentTab() {
  const [content, setContent] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editValue, setEditValue] = useState('');

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/site-content');
      setContent(res.data.content || []);
    } catch {
      message.error('Error al cargar contenido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const handleSave = async (item: SiteContent) => {
    try {
      await api.post('/admin/site-content', {
        section: item.section,
        contentKey: item.contentKey,
        contentValue: editValue,
        contentType: item.contentType,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      });
      message.success('Contenido actualizado');
      setEditingKey('');
      fetchContent();
    } catch {
      message.error('Error al guardar');
    }
  };

  // User-friendly Spanish labels for sections and content keys
  const sectionLabels: Record<string, string> = {
    about: 'Sobre Nosotros',
    hero: 'Portada Principal',
    footer: 'Pie de Página',
    contact: 'Contacto',
  };

  // Define the display order for sections
  const sectionOrder = ['about', 'hero', 'footer', 'contact'];

  const keyLabels: Record<string, string> = {
    title: 'Título',
    subtitle: 'Subtítulo',
    description: 'Descripción',
    mission: 'Misión',
    vision: 'Visión',
    copyright: 'Derechos de Autor',
    privacy_text: 'Texto de Privacidad',
    hours: 'Horario de Atención',
    emergency: 'Información de Emergencia',
  };

  // Content keys to exclude from editing (non-functional buttons removed)
  const excludedKeys = new Set(['cta_primary', 'cta_secondary']);

  const sections = [...new Set(content.map(c => c.section))]
    .sort((a, b) => {
      const aIdx = sectionOrder.indexOf(a);
      const bIdx = sectionOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Edite el texto que aparece en cada sección del sitio web público.
        </Text>
        <Button icon={<ReloadOutlined />} onClick={fetchContent}>Actualizar</Button>
      </div>
      {sections.length === 0 && !loading && (
        <Empty description="No hay contenido configurado. Se crearán las entradas por defecto al migrar la base de datos." />
      )}
      {sections.map(section => (
        <Card
          key={section}
          title={sectionLabels[section] || section}
          size="small"
          style={{ marginBottom: 16, borderRadius: 8 }}
        >
          {content.filter(c => c.section === section && !excludedKeys.has(c.contentKey)).map(item => {
            const isEditing = editingKey === `${item.section}-${item.contentKey}`;
            const friendlyLabel = keyLabels[item.contentKey] || item.contentKey;
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 160px', minWidth: 120 }}>
                  <Text strong style={{ fontSize: 13, color: '#374151' }}>{friendlyLabel}</Text>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {isEditing ? (
                    <TextArea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={3}
                      autoFocus
                      style={{ borderRadius: 8 }}
                    />
                  ) : (
                    <Text style={{ whiteSpace: 'pre-wrap', color: '#6b7280', fontSize: 13 }}>
                      {item.contentValue.length > 200 ? item.contentValue.slice(0, 200) + '...' : item.contentValue}
                    </Text>
                  )}
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  {isEditing ? (
                    <Space>
                      <Button type="primary" size="small" icon={<SaveOutlined />} onClick={() => handleSave(item)}>
                        Guardar
                      </Button>
                      <Button size="small" onClick={() => setEditingKey('')}>Cancelar</Button>
                    </Space>
                  ) : (
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setEditingKey(`${item.section}-${item.contentKey}`);
                        setEditValue(item.contentValue);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      ))}
    </Spin>
  );
}

// ══════════════════════════════════════════════
// SERVICES TAB - CRUD for marketing services
// ══════════════════════════════════════════════
function ServicesTab() {
  const [services, setServices] = useState<SiteService[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiteService | null>(null);
  const [form] = Form.useForm();

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/site-services');
      setServices(res.data.services || []);
    } catch {
      message.error('Error al cargar servicios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // Parse details from newline-separated text
      const details = values.detailsText
        ? values.detailsText.split('\n').map((d: string) => d.trim()).filter(Boolean)
        : [];

      const payload = { ...values, details, isActive: values.isActive ?? true };
      delete payload.detailsText;

      if (editing?.id) {
        await api.patch(`/admin/site-services/${editing.id}`, payload);
        message.success('Servicio actualizado');
      } else {
        await api.post('/admin/site-services', payload);
        message.success('Servicio creado');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchServices();
    } catch {
      message.error('Error al guardar servicio');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/site-services/${id}`);
      message.success('Servicio eliminado');
      fetchServices();
    } catch {
      message.error('Error al eliminar');
    }
  };

  const openEdit = (svc: SiteService) => {
    setEditing(svc);
    form.setFieldsValue({
      ...svc,
      detailsText: svc.details?.join('\n') || '',
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, sortOrder: services.length + 1 });
    setModalOpen(true);
  };

  const columns = [
    { title: 'Orden', dataIndex: 'sortOrder', key: 'sortOrder', width: 70 },
    { title: 'Título', dataIndex: 'title', key: 'title' },
    {
      title: 'Descripción', dataIndex: 'description', key: 'description',
      render: (text: string) => text ? (text.length > 80 ? text.slice(0, 80) + '...' : text) : '-',
    },
    {
      title: 'Estado', dataIndex: 'isActive', key: 'isActive',
      render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones', key: 'actions', width: 120,
      render: (_: unknown, record: SiteService) => (
        <Space>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>
          <Popconfirm title="¿Eliminar servicio?" onConfirm={() => handleDelete(record.id!)} okText="Sí" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text type="secondary">Servicios mostrados en la página de servicios del sitio web</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Servicio</Button>
      </div>
      <Table
        columns={columns}
        dataSource={services}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
      />
      <Modal
        title={editing ? 'Editar Servicio' : 'Nuevo Servicio'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="Guardar"
        cancelText="Cancelar"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Título" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Asesoría Legal" />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <TextArea rows={3} placeholder="Descripción del servicio..." />
          </Form.Item>
          <Form.Item name="detailsText" label="Detalles (uno por línea)">
            <TextArea rows={4} placeholder="Derecho Familiar&#10;Asuntos Civiles&#10;Orientación migratoria" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="icon" label="Ícono">
                <Input placeholder="balance-scale" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sortOrder" label="Orden">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isActive" label="Activo" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="imageUrl" label="URL de Imagen">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════
// EVENTS TAB - CRUD for public events
// ══════════════════════════════════════════════
function EventsTab() {
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiteEvent | null>(null);
  const [form] = Form.useForm();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/site-events');
      setEvents(res.data.events || []);
    } catch {
      message.error('Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        eventDate: values.eventDate?.toISOString(),
        endDate: values.endDate?.toISOString() || null,
        isActive: values.isActive ?? true,
      };

      if (editing?.id) {
        await api.patch(`/admin/site-events/${editing.id}`, payload);
        message.success('Evento actualizado');
      } else {
        await api.post('/admin/site-events', payload);
        message.success('Evento creado');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchEvents();
    } catch {
      message.error('Error al guardar evento');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/site-events/${id}`);
      message.success('Evento eliminado');
      fetchEvents();
    } catch {
      message.error('Error al eliminar');
    }
  };

  const openEdit = (evt: SiteEvent) => {
    setEditing(evt);
    form.setFieldsValue({
      ...evt,
      eventDate: evt.eventDate ? dayjs(evt.eventDate) : null,
      endDate: evt.endDate ? dayjs(evt.endDate) : null,
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Fecha', dataIndex: 'eventDate', key: 'eventDate', width: 120,
      render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : '-',
    },
    { title: 'Título', dataIndex: 'title', key: 'title' },
    { title: 'Ubicación', dataIndex: 'location', key: 'location' },
    {
      title: 'Estado', dataIndex: 'isActive', key: 'isActive',
      render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones', key: 'actions', width: 120,
      render: (_: unknown, record: SiteEvent) => (
        <Space>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>
          <Popconfirm title="¿Eliminar evento?" onConfirm={() => handleDelete(record.id!)} okText="Sí" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text type="secondary">Eventos públicos mostrados en la página de eventos del sitio web</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Evento</Button>
      </div>
      <Table columns={columns} dataSource={events} rowKey="id" loading={loading} size="small" pagination={false} />
      <Modal
        title={editing ? 'Editar Evento' : 'Nuevo Evento'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="Guardar"
        cancelText="Cancelar"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Título" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Taller de Finanzas Familiares" />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <TextArea rows={3} placeholder="Descripción del evento..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="eventDate" label="Fecha de Inicio" rules={[{ required: true, message: 'Requerido' }]}>
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label="Fecha de Fin">
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="location" label="Ubicación">
            <Input placeholder="Oficina Central" />
          </Form.Item>
          <Form.Item name="imageUrl" label="URL de Imagen">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="isActive" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════
// GALLERY TAB - Image management
// ══════════════════════════════════════════════
function GalleryTab() {
  const [images, setImages] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiteImage | null>(null);
  const [form] = Form.useForm();

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/site-images');
      setImages(res.data.images || []);
    } catch {
      message.error('Error al cargar imágenes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  // Upload a local file to the server and set the resulting URL in the form
  const handleFileUpload = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      message.error('Tipo de archivo no permitido. Use: JPG, PNG, GIF, WebP o SVG.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('El archivo es demasiado grande. Máximo 10 MB.');
      return false;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/admin/site-images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;
      if (url) {
        form.setFieldsValue({ imageUrl: url });
        message.success('Imagen subida correctamente');
      }
    } catch {
      message.error('Error al subir la imagen');
    } finally {
      setUploading(false);
    }
    return false; // Prevent default Upload behavior
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values, isActive: values.isActive ?? true };

      if (editing?.id) {
        await api.patch(`/admin/site-images/${editing.id}`, payload);
        message.success('Imagen actualizada');
      } else {
        await api.post('/admin/site-images', payload);
        message.success('Imagen creada');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchImages();
    } catch {
      message.error('Error al guardar imagen');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/site-images/${id}`);
      message.success('Imagen eliminada');
      fetchImages();
    } catch {
      message.error('Error al eliminar');
    }
  };

  const openEdit = (img: SiteImage) => {
    setEditing(img);
    form.setFieldsValue(img);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, section: 'gallery', sortOrder: images.length + 1 });
    setModalOpen(true);
  };

  const sectionLabels: Record<string, string> = {
    hero: 'Portada',
    gallery: 'Galería',
    about: 'Sobre Nosotros',
    services: 'Servicios',
  };

  const sectionOptions = [
    { label: 'Portada', value: 'hero' },
    { label: 'Galería', value: 'gallery' },
    { label: 'Sobre Nosotros', value: 'about' },
    { label: 'Servicios', value: 'services' },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>Imágenes del sitio web (portada, galería, servicios)</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva Imagen</Button>
      </div>

      {images.length === 0 && !loading && <Empty description="No hay imágenes cargadas" />}

      <Row gutter={[16, 16]}>
        {images.map(img => (
          <Col key={img.id} xs={12} sm={12} md={8} lg={6}>
            <Card
              hoverable
              size="small"
              style={{ borderRadius: 8, overflow: 'hidden' }}
              cover={
                <div style={{ height: 140, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                  {img.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img.imageUrl}
                      alt={img.altText || img.title || 'Imagen'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        // Prevent infinite loop by checking if already showing fallback
                        if (!target.dataset.fallback) {
                          target.dataset.fallback = 'true';
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f0f0f0;color:#999;font-size:12px;text-align:center;padding:8px;';
                            fallback.innerHTML = '<div><div style="font-size:24px;margin-bottom:4px;">🖼️</div>Error al cargar</div>';
                            parent.appendChild(fallback);
                          }
                        }
                      }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#f0f0f0', color: '#999', fontSize: 12, textAlign: 'center', padding: 8 }}>
                      <div><div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>Sin URL</div>
                    </div>
                  )}
                </div>
              }
              actions={[
                <Tooltip key="edit" title="Editar"><EditOutlined onClick={() => openEdit(img)} /></Tooltip>,
                <Popconfirm key="del" title="¿Eliminar imagen?" onConfirm={() => handleDelete(img.id!)} okText="Sí" cancelText="No">
                  <DeleteOutlined style={{ color: '#ff4d4f' }} />
                </Popconfirm>,
              ]}
            >
              <Card.Meta
                title={<span style={{ fontSize: 12 }}>{img.title || 'Sin título'}</span>}
                description={
                  <Tag style={{ fontSize: 11 }}>{sectionLabels[img.section] || img.section}</Tag>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title={editing ? 'Editar Imagen' : 'Nueva Imagen'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="Guardar"
        cancelText="Cancelar"
        width={520}
      >
        <Form form={form} layout="vertical">
          {/* Upload section */}
          <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8, border: '1px dashed #d9d9d9', textAlign: 'center' }}>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => handleFileUpload(file as unknown as File)}
              disabled={uploading}
            >
              <Button icon={<UploadOutlined />} loading={uploading} type="dashed">
                {uploading ? 'Subiendo...' : 'Subir Imagen desde Computadora'}
              </Button>
            </Upload>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              JPG, PNG, GIF, WebP o SVG. Máximo 10 MB.
            </div>
          </div>

          <Form.Item name="imageUrl" label="URL de Imagen" rules={[{ required: true, message: 'Suba una imagen o ingrese una URL' }]}>
            <Input placeholder="Se completará automáticamente al subir, o ingrese una URL" />
          </Form.Item>
          {form.getFieldValue('imageUrl') && (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Vista previa:</Text>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.getFieldValue('imageUrl')}
                alt="Vista previa"
                style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, border: '1px solid #d9d9d9' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title" label="Título">
                <Input placeholder="Título de la imagen" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="altText" label="Descripción">
                <Input placeholder="Descripción breve" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="section" label="Sección">
                <Select options={sectionOptions} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="sortOrder" label="Orden">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="isActive" label="Activo" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
