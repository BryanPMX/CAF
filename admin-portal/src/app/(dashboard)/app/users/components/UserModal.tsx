// admin-portal/src/app/(dashboard)/admin/users/components/UserModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message } from 'antd';
import { apiClient } from '../../../../lib/api';

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
      // Fetch the list of offices from the API to populate the dropdown menu.
      const fetchOffices = async () => {
        try {
          const response = await apiClient.get('/admin/offices');
          setOffices(response.data);
        } catch (error) {
          message.error('No se pudieron cargar las oficinas.');
        }
      };
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
        <Form.Item name="email" label="Correo Electrónico" rules={[{ required: true, type: 'email', message: 'Ingrese un correo válido' }]}>
          <Input />
        </Form.Item>
        {/* The password field is only required and visible when creating a new user. */}
        {!isEditing && (
          <Form.Item name="password" label="Contraseña Temporal" rules={[{ required: true, min: 8, message: 'La contraseña debe tener al menos 8 caracteres' }]}>
            <Input.Password />
          </Form.Item>
        )}
        <Form.Item name="role" label="Rol" rules={[{ required: true, message: 'Seleccione un rol' }]}>
          <Select placeholder="Asignar un rol" onChange={setSelectedRole}>
            <Option value="receptionist">Recepcionista</Option>
            <Option value="lawyer">Abogado(a)</Option>
            <Option value="psychologist">Psicólogo(a)</Option>
            <Option value="office_manager">Gerente de Oficina</Option>
            <Option value="event_coordinator">Coordinador de Eventos</Option>
            <Option value="admin">Administrador</Option>
            <Option value="client">Cliente</Option>
          </Select>
        </Form.Item>
        {/* The office dropdown is only shown for non-client roles. */}
        {selectedRole && selectedRole !== 'client' && (
          <Form.Item name="officeId" label="Oficina" rules={[{ required: true, message: 'Debe asignar una oficina al personal' }]}>
            <Select placeholder="Seleccione una oficina">
              {offices.map(o => <Option key={o.id} value={o.id}>{o.name}</Option>)}
            </Select>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default UserModal;




