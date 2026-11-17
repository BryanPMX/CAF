// admin-portal/src/app/(dashboard)/app/users/components/UserModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Alert, Modal, Form, Input, Select, message, Row, Col } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { useAuth } from '@/context/AuthContext';
import { supportsProfessionalSpecialty, requiresOffice, getAssignableRoles, canResetPasswords, USER_ROLES, type StaffRoleKey, canManageUser, canAccessAllOffices, isManagementRole, USER_MANAGEMENT_DENIED_MESSAGE } from '@/config/roles';
import EmploymentFields from '@/components/organizations/EmploymentFields';
import { employmentFromMemberships, type OrganizationMembership } from '@/app/lib/organizations';
import type { ProfileOrganizationInfo } from '@/app/lib/profile';
import { PROFILE_TEXT } from '@/config/profile';
import { ORGANIZATION_TEXT } from '@/config/organizations';
import { createPhoneFormRule, createStrongPasswordFormRule } from '@/core/validation';

const { Option } = Select;

// Define the data structures (TypeScript interfaces) used in this component for type safety.
interface Office {
  id: number;
  name: string;
}
interface User {
  organizationInfo?: ProfileOrganizationInfo;
  specialty?: string | null;
  clientType?: string;
  organizationMemberships?: OrganizationMembership[];
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
  const { user: currentUser, updateUser, logout } = useAuth();
  const [form] = Form.useForm(); // Ant Design's hook to control the form state.
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentUserRole = currentUser?.role;
  const currentUserOfficeId = currentUser?.officeId;
  const isAuthorized = user ? canManageUser(currentUser, user) : isManagementRole(currentUserRole ?? '');
  const selectedMaquilaId = Form.useWatch(['employment', 'maquilaId'], form);
  const isEditing = !!user; // A simple boolean flag to determine if we are in "edit" mode.

  // This `useEffect` hook runs whenever the modal becomes visible or the user to be edited changes.
  useEffect(() => {
    if (visible && isAuthorized) {
      setSubmitError(null);
      // Fetch offices for office administrators - run always when modal opens
      const fetchOffices = async () => {
        try {
          // Use the same authenticated actor as the target-account policy.
          if (currentUserRole && isManagementRole(currentUserRole)) {
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

      form.resetFields();
      // If we are editing an existing user, populate the form with their data.
      if (isEditing) {
        form.setFieldsValue({
          ...user,
          specialty: user.organizationInfo?.specialty || user.specialty || '',
          employment: employmentFromMemberships(user.organizationMemberships),
          officeId: user.officeId,
          phone: user.phone ?? '',
          personalAddress: user.personalAddress ?? '',
        });
        setSelectedRole(user.role);
      } else {
        // If we are creating a new user, ensure the form is empty.
        setSelectedRole('');
        if (!canAccessAllOffices(currentUserRole ?? '') && currentUserOfficeId) {
          form.setFieldsValue({ officeId: currentUserOfficeId });
        }
      }
    }
  }, [visible, user, form, isEditing, isAuthorized, currentUserRole, currentUserOfficeId]);

  // This function is called when the user clicks the "OK" button in the modal footer.
  const handleOk = async () => {
    if (!isAuthorized) {
      message.error(USER_MANAGEMENT_DENIED_MESSAGE);
      return;
    }
    const messageKey = isEditing ? 'updateUser' : 'createUser';
    try {
      setSubmitError(null);
      const values = await form.validateFields();
      if (values.role !== USER_ROLES.CLIENT || user?.clientType === 'organization') delete values.employment;
      if (!supportsProfessionalSpecialty(values.role)) delete values.specialty;
      if (isEditing && !values.password) delete values.password;
      setLoading(true);
      message.loading({ content: 'Guardando...', key: messageKey });

      // Determine the base endpoint based on user role
      const base = '/admin';

      if (isEditing) {
        // If editing, send a PATCH request to the update endpoint.
        const response = await apiClient.patch(`${base}/users/${user.id}`, values);
        const updated = response?.data;
        // If the edited user is the current user, sync auth context so the header "Bienvenido, ..." updates (server response only).
        if (values.password && updated?.id === currentUser?.id) {
          onClose();
          logout();
          return;
        }
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
        // The API enforces the requesting manager's office and role boundaries.
        await apiClient.post(`${base}/users`, values);
      }

      message.success({ content: `¡Usuario ${isEditing ? 'actualizado' : 'creado'} exitosamente!`, key: messageKey });
      onSuccess(); // Trigger the callback to refresh the user list on the parent page.
      onClose(); // Close the modal.
    } catch (error: unknown) {
      const validationError = typeof error === 'object' && error && 'errorFields' in error;
      const apiError = typeof error === 'object' && error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      const errorMessage = validationError
        ? 'Revise los campos marcados antes de guardar.'
        : apiError || 'No fue posible guardar el usuario.';
      setSubmitError(errorMessage);
      message.error({ content: errorMessage, key: messageKey });
    } finally {
      setLoading(false);
    }
  };


  // Handle role selection change
  const handleRoleChange = (roleValue: string) => {
    if (roleValue !== selectedRole) form.setFieldValue('specialty', '');
    setSelectedRole(roleValue);
    if (canAccessAllOffices(roleValue)) {
      form.setFieldsValue({ officeId: undefined });
      return;
    }
    
    // For office administrators creating/editing to staff role: auto-set their office
    // This is needed because the office dropdown is disabled for staff roles
    if (!canAccessAllOffices(currentUserRole ?? '')) {
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
    return getAssignableRoles(currentUserRole ?? '', user?.role);
  };

  if (!isAuthorized) return null;

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
        {submitError && (
          <Alert
            showIcon
            closable
            type="error"
            className="mb-4"
            message="No se pudo guardar"
            description={submitError}
            onClose={() => setSubmitError(null)}
          />
        )}
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="firstName" label="Nombre(s)" rules={[{ required: true, message: 'El nombre es requerido' }]}>
              <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Ej. María" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} hidden={user?.clientType === 'organization'}>
            <Form.Item name="lastName" label="Apellidos" rules={[{ required: user?.clientType !== 'organization', message: 'El apellido es requerido' }]}>
              <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Ej. García López" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="email"
          label="Correo Electrónico Organizacional"
          rules={[
            { required: user?.clientType !== 'organization' && (isEditing || selectedRole === USER_ROLES.CLIENT), message: 'El correo electrónico es requerido' },
            { type: 'email', message: 'Ingrese un correo válido' },
          ]}
          extra={!isEditing && selectedRole && selectedRole !== 'client' ? 'Si se deja vacío se generará uno corporativo automáticamente.' : undefined}
        >
          <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="ejemplo@caf-mexico.com" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Número de Teléfono"
          rules={[{ required: user?.clientType !== 'organization', message: 'El teléfono es requerido' }, { validator: createPhoneFormRule(user?.clientType !== 'organization') }]}
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

        {(!isEditing || canResetPasswords(currentUserRole ?? '')) && (
          <Form.Item
            name="password"
            label={isEditing ? "Nueva contraseña" : "Contraseña Temporal"}
            rules={[{ validator: createStrongPasswordFormRule(!isEditing) }]}
            extra={isEditing ? "Deje vacío para conservar la contraseña. Al cambiarla se cerrarán las sesiones del usuario." : "Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo."}
          >
            <Input.Password maxLength={72} placeholder="Contraseña temporal segura" />
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="role" label="Rol" rules={[{ required: true, message: 'Seleccione un rol' }]}>
              <Select disabled={user?.role === USER_ROLES.TECHNICAL_SUPPORT || user?.clientType === 'organization'} placeholder="Asignar un rol" onChange={handleRoleChange}>
                {getAvailableRoles().map((role) => (
                  <Option key={role.value} value={role.value}>{role.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          {!canAccessAllOffices(selectedRole) && (
            <Col xs={24} sm={12}>
              <Form.Item
                name="officeId"
                label="Oficina"
                rules={
                  selectedRole && (requiresOffice(selectedRole as StaffRoleKey) || (selectedRole === USER_ROLES.CLIENT && Boolean(selectedMaquilaId))) && canAccessAllOffices(currentUserRole ?? '')
                    ? [{ required: true, message: ORGANIZATION_TEXT.officeRequired }]
                    : []
                }
              >
                <Select
                  placeholder={selectedRole ? 'Seleccione una oficina' : 'Primero seleccione un rol'}
                  allowClear={selectedRole === USER_ROLES.CLIENT}
                  disabled={!selectedRole || !canAccessAllOffices(currentUserRole ?? '') || user?.clientType === 'organization'}
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
          )}
        </Row>

        {supportsProfessionalSpecialty(selectedRole || '') && (
          <Form.Item name="specialty" label={PROFILE_TEXT.specialty} extra={PROFILE_TEXT.specialtyHint}>
            <Input maxLength={100} />
          </Form.Item>
        )}
        {selectedRole === USER_ROLES.CLIENT && user?.clientType !== 'organization' && <EmploymentFields />}
        {user?.clientType === 'organization' && <p className="text-sm text-slate-500">{ORGANIZATION_TEXT.companyHint}</p>}

        {!selectedRole && (
          <div style={{ color: '#999', fontSize: '12px', marginTop: -8, marginBottom: 8 }}>
            ℹ️ Seleccione un rol primero para asignar una oficina
          </div>
        )}
        {!canAccessAllOffices(selectedRole) && offices.length === 0 && (
          <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: -8, marginBottom: 8 }}>
            ⚠️ No hay oficinas disponibles. Contacte al administrador.
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default UserModal;




