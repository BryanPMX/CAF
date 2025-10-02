// admin-portal/src/app/(dashboard)/app/users/components/UserModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message } from 'antd';
import { apiClient } from '@/app/lib/api';
import { STAFF_ROLES, requiresOffice, getAllRoles, USER_ROLES, type StaffRoleKey } from '@/config/roles';

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
  officeId?: number; // officeId is optional, especially for clients.
}

// Define the props (properties) that this component accepts from its parent.
interface UserModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // A callback function to refresh the user list after a successful operation.
  user?: User | null; // Pass a user object when editing. If it's null, we are in "create" mode.
}

const UserModal: React.FC<UserModalProps> = ({ visible, onClose, onSuccess, user }) => {
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
          const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'admin';
          console.log('Fetching offices for role:', role);
          // Check if the current user can manage users (admin or office_manager)
          if (role === 'admin' || role === 'office_manager') {
            // Use appropriate endpoint based on role - admins use admin endpoint, others use protected endpoint
            const endpoint = role === 'admin' ? '/admin/offices' : '/offices';
            console.log('Fetching offices from endpoint:', endpoint);
            const response = await apiClient.get(endpoint);
            console.log('Offices loaded:', response.data);
            setOffices(response.data);
          } else {
            console.log('User role does not allow office management:', role);
            setOffices([]);
          }
        } catch (error) {
          console.error('Error fetching offices:', error);
          setOffices([]);
        }
      };
      
      // Always fetch offices when modal opens, regardless of current role selection
      fetchOffices();

      // If we are editing an existing user, populate the form with their data.
      if (isEditing) {
        form.setFieldsValue({
          ...user,
          officeId: user.officeId, // Ensure officeId is set correctly
        });
        setSelectedRole(user.role);
      } else {
        // If we are creating a new user, ensure the form is empty.
        form.resetFields();
        setSelectedRole('');
        // Prefill office for office managers creating staff
        if (typeof window !== 'undefined') {
          const role = localStorage.getItem('userRole');
          const officeId = localStorage.getItem('userOfficeId');
          if (role === 'office_manager' && officeId) {
            form.setFieldsValue({ officeId: Number(officeId) });
          }
        }
      }
    }
  }, [visible, user, form, isEditing]);

  // This function is called when the user clicks the "OK" button in the modal footer.
  const handleOk = async () => {
    try {
      const values = await form.validateFields(); // Ensure all form fields are valid.
      setLoading(true);
      const messageKey = isEditing ? 'updateUser' : 'createUser';
      message.loading({ content: 'Guardando...', key: messageKey });

      if (isEditing) {
        // If editing, send a PATCH request to the update endpoint.
        await apiClient.patch(`/admin/users/${user.id}`, values);
      } else {
        // If creating, send a POST request to the create endpoint.
        await apiClient.post('/admin/users', values);
      }

      message.success({ content: `¡Usuario ${isEditing ? 'actualizado' : 'creado'} exitosamente!`, key: messageKey });
      onSuccess(); // Trigger the callback to refresh the user list on the parent page.
      onClose(); // Close the modal.
    } catch (error: any) {
      // If the API returns an error, display it to the user.
      const errorMessage = error.response?.data?.error || 'Ocurrió un error.';
      message.error({ content: errorMessage, key: 'createUser' });
    } finally {
      setLoading(false);
    }
  };

  // Handle role selection change
  const handleRoleChange = (roleValue: string) => {
    setSelectedRole(roleValue);
    // Only clear office selection if the role is client
    if (roleValue === USER_ROLES.CLIENT) {
      form.setFieldsValue({ officeId: undefined });
    }
  };

  return (
    <Modal
      title={isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose // This is a helpful prop that resets form fields when the modal is closed.
    >
      <Form form={form} layout="vertical">
        <Form.Item name="firstName" label="Nombre(s)" rules={[{ required: true, message: 'El nombre es requerido' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="lastName" label="Apellidos" rules={[{ required: true, message: 'El apellido es requerido' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="email"
          label="Correo Electrónico Organizacional"
          rules={[
            { required: true, message: 'El correo electrónico organizacional es requerido' },
            { type: 'email', message: 'Ingrese un correo válido' },
          ]}
          extra={selectedRole && selectedRole !== 'client' ? 'Requerido: ingrese el correo organizacional o se generará uno corporativo automáticamente.' : undefined}
        >
          <Input placeholder="ejemplo@caf.org" />
        </Form.Item>
        {/* The password field is only required and visible when creating a new user. */}
        {!isEditing && (
          <Form.Item name="password" label="Contraseña Temporal" rules={[{ required: true, min: 8, message: 'La contraseña debe tener al menos 8 caracteres' }]}>
            <Input.Password />
          </Form.Item>
        )}
        <Form.Item name="role" label="Rol" rules={[{ required: true, message: 'Seleccione un rol' }]}>
          <Select placeholder="Asignar un rol" onChange={handleRoleChange}>
            {getAllRoles().map((role) => (
               <Option key={role.value} value={role.value}>
                 {role.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
        {/* Office assignment field - always visible */}
        <Form.Item 
          name="officeId" 
          label="Oficina"
          rules={
            selectedRole && requiresOffice(selectedRole as StaffRoleKey) 
              ? [{ required: true, message: 'Debe asignar una oficina al personal' }]
              : []
          }
        >
          {selectedRole === USER_ROLES.CLIENT ? (
            <Select placeholder="Los clientes no requieren oficina" disabled>
              <Option value={null}>No aplica</Option>
            </Select>
          ) : (
            <Select
              placeholder={selectedRole ? "Seleccione una oficina" : "Primero seleccione un rol"}
              allowClear
              disabled={
                (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'office_manager') ||
                !selectedRole
              }
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
              }
            >
              {offices.map(office => (
                <Option key={office.id} value={office.id}>
                  {office.name}
                </Option>
              ))}
            </Select>
          )}
        </Form.Item>
        {/* Helper text and status messages */}
        {selectedRole && selectedRole !== USER_ROLES.CLIENT && requiresOffice(selectedRole as StaffRoleKey) && (
          <div style={{ color: '#666', fontSize: '12px', marginTop: '-16px', marginBottom: '8px' }}>
            ℹ️ Requerido para {selectedRole === USER_ROLES.EVENT_COORDINATOR ? 'coordinadores de eventos' : 'personal'}
          </div>
        )}
        {!selectedRole && (
          <div style={{ color: '#999', fontSize: '12px', marginTop: '-16px', marginBottom: '8px' }}>
            ℹ️ Seleccione un rol primero para asignar una oficina
          </div>
        )}
        {offices.length === 0 && (
          <div style={{ color: 'red', fontSize: '12px', marginTop: '-16px', marginBottom: '8px' }}>
            ⚠️ No hay oficinas disponibles. contacte al administrador.
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default UserModal;




