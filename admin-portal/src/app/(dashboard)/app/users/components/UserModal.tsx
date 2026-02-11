// admin-portal/src/app/(dashboard)/app/users/components/UserModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Row, Col } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import Cookies from 'js-cookie';
import { apiClient } from '@/app/lib/api';
import { useAuth } from '@/context/AuthContext';
import { STAFF_ROLES, requiresOffice, getAllRoles, USER_ROLES, type StaffRoleKey } from '@/config/roles';
import type { AuthUser } from '@/app/lib/types';

const { Option } = Select;

// Define the data structures (TypeScript interfaces) used in this component for type safety.
interface Office {
  id: number;
  name: string;
}
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  officeId?: number;
  phone?: string;
  personalAddress?: string;
}

// Define the props (properties) that this component accepts from its parent.
interface UserModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // A callback function to refresh the user list after a successful operation.
  user?: User | null; // Pass a user object when editing. If it's null, we are in "create" mode.
}

const UserModal: React.FC<UserModalProps> = ({ visible, onClose, onSuccess, user }) => {
  const { user: currentUser, updateUser } = useAuth();
  const [form] = Form.useForm(); // Ant Design's hook to control the form state.
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const isEditing = !!user; // A simple boolean flag to determine if we are in "edit" mode.

  // This `useEffect` hook runs whenever the modal becomes visible or the user to be edited changes.
  useEffect(() => {
    if (visible) {
      // Fetch offices for admins and office managers - run always when modal opens
      const fetchOffices = async () => {
        try {
          // Get role from cookie (not localStorage) as set by AuthContext
          const role = typeof window !== 'undefined' ? Cookies.get('userRole') : 'admin';
          // Check if the current user can manage users (admin or office_manager)
          if (role === 'admin' || role === 'office_manager') {
            const response = await apiClient.get('/offices');
            setOffices(response.data);
          } else {
            setOffices([]);
          }
        } catch {
          setOffices([]);
        }
      };
      
      // Always fetch offices when modal opens, regardless of current role selection
      fetchOffices();

      // If we are editing an existing user, populate the form with their data.
      if (isEditing) {
        form.setFieldsValue({
          ...user,
          officeId: user.officeId,
          phone: user.phone ?? '',
          personalAddress: user.personalAddress ?? '',
        });
        setSelectedRole(user.role);
      } else {
        // If we are creating a new user, ensure the form is empty.
        form.resetFields();
        setSelectedRole('');
        // Prefill office for office managers creating staff
        if (typeof window !== 'undefined') {
          const role = Cookies.get('userRole');
          const officeId = Cookies.get('userOfficeId');
          if (role === 'office_manager' && officeId) {
            form.setFieldsValue({ officeId: Number(officeId) });
          }
        }
      }
    }
  }, [visible, user, form, isEditing]);

  // This function is called when the user clicks the "OK" button in the modal footer.
  const handleOk = async () => {
    const messageKey = isEditing ? 'updateUser' : 'createUser';
    try {
      const values = await form.validateFields(); // Ensure all form fields are valid.
      setLoading(true);
      message.loading({ content: 'Guardando...', key: messageKey });

      // Determine the base endpoint based on user role
      const role = typeof window !== 'undefined' ? Cookies.get('userRole') : 'admin';
      const base = role === 'office_manager' ? '/manager' : '/admin';

      if (isEditing) {
        // If editing, send a PATCH request to the update endpoint.
        const response = await apiClient.patch(`${base}/users/${user.id}`, values);
        const updated = response?.data;
        // If the edited user is the current user, sync auth context so the header "Bienvenido, ..." updates (server response only).
        if (currentUser && updated && Number(updated.id) === currentUser.id && typeof updated.firstName === 'string' && typeof updated.lastName === 'string') {
          updateUser({
            id: updated.id,
            role: updated.role,
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
            officeId: updated.officeId != null ? updated.officeId : undefined,
          });
        }
      } else {
        // If creating, send a POST request to the create endpoint.
        // Office managers: can create clients for any office, staff only for their office
        await apiClient.post(`${base}/users`, values);
      }

      message.success({ content: `¡Usuario ${isEditing ? 'actualizado' : 'creado'} exitosamente!`, key: messageKey });
      onSuccess(); // Trigger the callback to refresh the user list on the parent page.
      onClose(); // Close the modal.
    } catch (error: any) {
      // If the API returns an error, display it to the user.
      const errorMessage = error.response?.data?.error || 'Ocurrió un error.';
      message.error({ content: errorMessage, key: messageKey });
    } finally {
      setLoading(false);
    }
  };

  // Get current user role
  const currentUserRole = typeof window !== 'undefined' ? Cookies.get('userRole') : 'admin';
  const currentUserOfficeId = typeof window !== 'undefined' ? Cookies.get('userOfficeId') : undefined;

  // Handle role selection change
  const handleRoleChange = (roleValue: string) => {
    setSelectedRole(roleValue);
    
    // For office managers creating/editing to staff role: auto-set their office
    // This is needed because the office dropdown is disabled for staff roles
    if (currentUserRole === 'office_manager' && roleValue !== USER_ROLES.CLIENT) {
      if (currentUserOfficeId) {
        form.setFieldsValue({ officeId: Number(currentUserOfficeId) });
      }
    } else if (!isEditing && roleValue === USER_ROLES.CLIENT) {
      // Clear office for clients when creating (optional)
      form.setFieldsValue({ officeId: undefined });
    }
    // When editing and changing TO client, keep existing office (user can change it manually)
  };

  // Get available roles based on current user's role
  const getAvailableRoles = () => {
    const allRoles = getAllRoles();
    // Office managers cannot create admin users
    if (currentUserRole === 'office_manager') {
      return allRoles.filter(role => role.value !== USER_ROLES.ADMIN);
    }
    return allRoles;
  };

  const phonePattern = /^[\d\s\+\-\(\)\.]{7,25}$/;
  const validatePhone = (_: unknown, value: string) => {
    const s = (value ?? '').trim();
    if (!s) return Promise.reject(new Error('El número de teléfono es requerido'));
    if (!phonePattern.test(s)) return Promise.reject(new Error('Formato inválido. Use dígitos, espacios, +, -, () o . (ej: +52 656 123 4567)'));
    return Promise.resolve();
  };

  return (
    <Modal
      title={isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" className="mt-2">
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="firstName" label="Nombre(s)" rules={[{ required: true, message: 'El nombre es requerido' }]}>
              <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Ej. María" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="lastName" label="Apellidos" rules={[{ required: true, message: 'El apellido es requerido' }]}>
              <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Ej. García López" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="email"
          label="Correo Electrónico Organizacional"
          rules={[
            { required: true, message: 'El correo electrónico es requerido' },
            { type: 'email', message: 'Ingrese un correo válido' },
          ]}
          extra={selectedRole && selectedRole !== 'client' ? 'Si se deja vacío se generará uno corporativo automáticamente.' : undefined}
        >
          <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="ejemplo@caf.org" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Número de Teléfono"
          rules={[{ required: true, message: 'El teléfono es requerido' }, { validator: validatePhone }]}
        >
          <Input prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />} placeholder="+52 656 123 4567" />
        </Form.Item>

        <Form.Item
          name="personalAddress"
          label="Domicilio Personal (opcional)"
        >
          <Input.TextArea
            placeholder="Calle, número, colonia, ciudad, estado, CP"
            rows={2}
            showCount
            maxLength={500}
          />
        </Form.Item>

        {!isEditing && (
          <Form.Item name="password" label="Contraseña Temporal" rules={[{ required: true, min: 8, message: 'La contraseña debe tener al menos 8 caracteres' }]}>
            <Input.Password placeholder="Mínimo 8 caracteres" />
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="role" label="Rol" rules={[{ required: true, message: 'Seleccione un rol' }]}>
              <Select placeholder="Asignar un rol" onChange={handleRoleChange}>
                {getAvailableRoles().map((role) => (
                  <Option key={role.value} value={role.value}>{role.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="officeId"
              label="Oficina"
              rules={
                selectedRole && requiresOffice(selectedRole as StaffRoleKey) && currentUserRole !== 'office_manager'
                  ? [{ required: true, message: 'Debe asignar una oficina al personal' }]
                  : []
              }
            >
              <Select
                placeholder={selectedRole ? 'Seleccione una oficina' : 'Primero seleccione un rol'}
                allowClear={selectedRole === USER_ROLES.CLIENT}
                disabled={!selectedRole || (currentUserRole === 'office_manager' && selectedRole !== USER_ROLES.CLIENT)}
                showSearch
                filterOption={(input, option) =>
                  (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {offices.map(office => (
                  <Option key={office.id} value={office.id}>{office.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {currentUserRole === 'office_manager' && selectedRole && selectedRole !== USER_ROLES.CLIENT && (
          <div style={{ color: '#1890ff', fontSize: '12px', marginTop: -8, marginBottom: 8 }}>
            ℹ️ El personal se asignará automáticamente a su oficina
          </div>
        )}
        {!selectedRole && (
          <div style={{ color: '#999', fontSize: '12px', marginTop: -8, marginBottom: 8 }}>
            ℹ️ Seleccione un rol primero para asignar una oficina
          </div>
        )}
        {offices.length === 0 && (
          <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: -8, marginBottom: 8 }}>
            ⚠️ No hay oficinas disponibles. Contacte al administrador.
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default UserModal;




