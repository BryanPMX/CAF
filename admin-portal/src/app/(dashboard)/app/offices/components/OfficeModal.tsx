// admin-portal/src/app/(dashboard)/app/offices/components/OfficeModal.tsx
'use client';

import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { apiClient } from '@/app/lib/api';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface Office {
  id: number;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

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
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  // This effect runs when the modal opens or the 'office' prop changes.
  // It populates the form with the office data when in edit mode.
  useEffect(() => {
    if (visible) {
      if (office) {
        form.setFieldsValue(office);
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
      message.warning('Google Maps API key no configurada (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).');
      return;
    }
    setGeocoding(true);
    try {
      const params = new URLSearchParams({ address: trimmed, key: googleMapsApiKey });
      const res = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`);
      const data = await res.json();
      if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
        const msg = data.status === 'ZERO_RESULTS'
          ? 'No se encontró la dirección. Prueba con una más específica.'
          : data.error_message || `Geocoding: ${data.status}`;
        message.error(msg);
        return;
      }
      const { lat, lng } = data.results[0].geometry.location;
      form.setFieldsValue({ latitude: lat, longitude: lng });
      message.success('Coordenadas obtenidas. Revisa y guarda si son correctas.');
    } catch (err: any) {
      message.error(err?.message || 'Error al obtener coordenadas.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // Convert lat/lng strings to numbers for API
      const payload = { ...values };
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

  return (
    <Modal
      title={isEditing ? 'Editar Oficina' : 'Crear Nueva Oficina'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Nombre de la Oficina"
          rules={[{ required: true, message: 'El nombre es requerido' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="address"
          label="Dirección"
          rules={[{ required: true, message: 'La dirección es requerida' }]}
          extra={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <Button
                type="primary"
                ghost
                size="small"
                loading={geocoding}
                onClick={fetchCoordinatesFromAddress}
                style={{ alignSelf: 'flex-start' }}
              >
                {geocoding ? 'Buscando…' : 'Obtener coordenadas desde dirección'}
              </Button>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const address = form.getFieldValue('address') || '';
                  const query = (typeof address === 'string' ? address.trim() : '') || 'Ciudad Juárez, Chihuahua';
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
                    '_blank',
                    'noopener,noreferrer'
                  );
                }}
                style={{ fontSize: 12 }}
              >
                Abrir en Google Maps (copiar lat/long manualmente)
              </a>
            </div>
          }
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          name="latitude"
          label="Latitud"
          help="Para el mapa de la página de contacto. Usa «Obtener coordenadas desde dirección» o abre la dirección en Google Maps."
          rules={[{ required: true, message: 'La latitud es requerida' }]}
        >
          <Input type="number" step="any" placeholder="31.6904" />
        </Form.Item>
        <Form.Item
          name="longitude"
          label="Longitud"
          help="Para el mapa de la página de contacto. Ej: -106.4245"
          rules={[{ required: true, message: 'La longitud es requerida' }]}
        >
          <Input type="number" step="any" placeholder="-106.4245" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default OfficeModal;