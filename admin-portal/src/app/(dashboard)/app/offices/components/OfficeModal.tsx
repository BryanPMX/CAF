// admin-portal/src/app/(dashboard)/app/offices/components/OfficeModal.tsx
'use client';

import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message, Row, Col, Space } from 'antd';
import { EnvironmentOutlined, LinkOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';

/** Load Google Maps JS API once. Uses JS API Geocoder so referrer-restricted keys work (REST Geocoding API rejects them). */
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in browser'));
  const w = window as any;
  if (w.google?.maps?.Geocoder) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const check = () => (w.google?.maps ? resolve() : setTimeout(check, 50));
      check();
      return;
    }
    const cb = '___adminGeocoderReady';
    w[cb] = () => {
      delete w[cb];
      resolve();
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${cb}`;
    script.async = true;
    script.onerror = () => {
      delete w[cb];
      reject(new Error('Error cargando Google Maps'));
    };
    document.head.appendChild(script);
  });
}

interface Office {
  id: number;
  name: string;
  address: string;
  phoneOffice?: string;
  phoneCell?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const PHONE_PATTERN = /^[\d\s\+\-\(\)\.]{7,25}$/;
const phoneValidator = (_: unknown, value: unknown) => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return Promise.resolve();
  if (!PHONE_PATTERN.test(s)) {
    return Promise.reject(new Error('Formato inválido. Use dígitos, espacios, +, -, () o . (ej: +52 656 123 4567)'));
  }
  return Promise.resolve();
};

interface OfficeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  office?: Office | null; // Pass an office object when editing
}

const OfficeModal: React.FC<OfficeModalProps> = ({ visible, onClose, onSuccess, office }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [geocoding, setGeocoding] = React.useState(false);
  const isEditing = !!office;
  // Next.js exposes only vars in next.config.js env; both are inlined from VITE_GOOGLE_MAPS_API_KEY at build time.
  // On Vercel, set VITE_GOOGLE_MAPS_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) for the admin portal project.
  const googleMapsApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

  // This effect runs when the modal opens or the 'office' prop changes.
  // It populates the form with the office data when in edit mode.
  useEffect(() => {
    if (visible) {
      if (office) {
        form.setFieldsValue({
          ...office,
          phoneOffice: office.phoneOffice ?? '',
          phoneCell: office.phoneCell ?? '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [visible, office, form]);

  const fetchCoordinatesFromAddress = async () => {
    const address = form.getFieldValue('address');
    const trimmed = typeof address === 'string' ? address.trim() : '';
    if (!trimmed) {
      message.warning('Escribe la dirección primero para obtener las coordenadas.');
      return;
    }
    if (!googleMapsApiKey) {
      message.warning(
        'Google Maps API key no configurada. En Vercel, configure VITE_GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para el proyecto del portal de administración.'
      );
      return;
    }
    setGeocoding(true);
    try {
      await loadGoogleMapsScript(googleMapsApiKey);
      const geocoder = new (window as any).google.maps.Geocoder();
      await new Promise<void>((resolve, reject) => {
        geocoder.geocode({ address: trimmed }, (results: any[], status: string) => {
          if (status !== 'OK' || !results?.[0]?.geometry?.location) {
            const msg =
              status === 'ZERO_RESULTS'
                ? 'No se encontró la dirección. Prueba con una más específica.'
                : `Geocoding: ${status}`;
            reject(new Error(msg));
            return;
          }
          const loc = results[0].geometry.location;
          const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
          form.setFieldsValue({ latitude: lat, longitude: lng });
          message.success('Coordenadas obtenidas');
          resolve();
        });
      });
    } catch (err: any) {
      message.error(err?.message || 'Error al obtener coordenadas.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // Build payload: convert lat/lng, include optional phone fields
      const payload = {
        ...values,
        phoneOffice: (values.phoneOffice ?? '').trim(),
        phoneCell: (values.phoneCell ?? '').trim(),
      };
      if (values.latitude !== undefined && values.latitude !== '' && values.latitude !== null) {
        payload.latitude = parseFloat(values.latitude);
      } else {
        payload.latitude = null;
      }
      if (values.longitude !== undefined && values.longitude !== '' && values.longitude !== null) {
        payload.longitude = parseFloat(values.longitude);
      } else {
        payload.longitude = null;
      }
      setLoading(true);
      const messageKey = isEditing ? 'updateOffice' : 'createOffice';
      message.loading({ content: 'Guardando...', key: messageKey });

      if (isEditing) {
        // If editing, send a PATCH request to the update endpoint
        await apiClient.patch(`/admin/offices/${office.id}`, payload);
      } else {
        // If creating, send a POST request
        await apiClient.post('/admin/offices', payload);
      }

      message.success({ content: `¡Oficina ${isEditing ? 'actualizada' : 'creada'} exitosamente!`, key: messageKey });
      onSuccess(); // Refresh the list on the parent page
      onClose(); // Close the modal
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Ocurrió un error.';
      message.error({ content: errorMessage, key: 'createOffice' });
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = () => {
    const address = form.getFieldValue('address') || '';
    const query = (typeof address === 'string' ? address.trim() : '') || 'Ciudad Juárez, Chihuahua';
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <Modal
      title={isEditing ? 'Editar Oficina' : 'Crear Nueva Oficina'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Nombre de la Oficina"
          rules={[{ required: true, message: 'El nombre es requerido' }]}
        >
          <Input placeholder="Ej. Oficina Central" />
        </Form.Item>
        <Form.Item
          name="address"
          label="Dirección"
          rules={[{ required: true, message: 'La dirección es requerida' }]}
          extra={
            <Space size="small" style={{ marginTop: 6 }}>
              <Button
                type="primary"
                ghost
                size="small"
                icon={<EnvironmentOutlined />}
                loading={geocoding}
                onClick={fetchCoordinatesFromAddress}
              >
                {geocoding ? 'Buscando…' : 'Obtener coordenadas'}
              </Button>
              <Button
                type="default"
                ghost
                size="small"
                icon={<LinkOutlined />}
                onClick={openInGoogleMaps}
              >
                Abrir en Google Maps
              </Button>
            </Space>
          }
        >
          <Input.TextArea rows={2} placeholder="Calle, colonia, ciudad, estado" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="phoneOffice"
              label="Teléfono Oficina"
              rules={[{ validator: phoneValidator }]}
            >
              <Input placeholder="+52 656 123 4567" maxLength={25} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="phoneCell"
              label="Teléfono Celular"
              rules={[{ validator: phoneValidator }]}
            >
              <Input placeholder="+52 656 987 6543" maxLength={25} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="latitude"
              label="Latitud"
              help="Para el mapa de la página de contacto"
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <Input type="number" step="any" placeholder="31.6904" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="longitude"
              label="Longitud"
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <Input type="number" step="any" placeholder="-106.4245" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default OfficeModal;