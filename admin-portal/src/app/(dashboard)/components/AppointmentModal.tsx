// admin-portal/src/app/(dashboard)/components/AppointmentModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Button, message, Select, Radio, AutoComplete, Steps, Spin, Typography } from 'antd';
import { CASE_TYPES, findDepartmentByCaseType } from '@/app/lib/caseTaxonomy';
import { getRoleDisplayName, isAdminRole, getRolesForCaseCategory, StaffRoleKey } from '@/config/roles';
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_OPTIONS } from '@/config/statuses';
import { useAuth } from '@/context/AuthContext';
import {
  WorkflowService,
  type WorkflowCase,
  type WorkflowOffice,
  type WorkflowUser,
} from '@/services/workflowService';
import AppointmentAvailabilityPicker from './AppointmentAvailabilityPicker';
import { availableAppointmentSlots, loadEmployeeAvailability, type AppointmentSlot } from '@/services/appointmentAvailability';

const { Option } = Select;
const { Text } = Typography;

// --- TypeScript Interfaces for data clarity ---
interface ClientSearchResult { value: string; label: string; key: number; }

interface AppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingAppointment?: {
    clientId: number;
    caseId: number;
  } | null;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ visible, onClose, onSuccess, existingAppointment }) => {
  const [form] = Form.useForm();
  const watchedClientId = Form.useWatch('clientId', form);
  const watchedDepartment = Form.useWatch('department', form);
  const watchedStaffId = Form.useWatch('staffId', form) as number | undefined;
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const { user } = useAuth();
  
  // --- State for data fetched from the API ---
  const [cases, setCases] = useState<WorkflowCase[]>([]);
  const [staffList, setStaffList] = useState<WorkflowUser[]>([]);
  const [offices, setOffices] = useState<WorkflowOffice[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientSearchResult[]>([]);
  const [recentClients, setRecentClients] = useState<ClientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- State for user selections and filtering ---
  const [clientMode, setClientMode] = useState('existing');
  const [caseMode, setCaseMode] = useState('existing');
  const [selectedClientLabel, setSelectedClientLabel] = useState<string>('');
  const [clientInputValue, setClientInputValue] = useState<string>('');
  const [selectedCaseCategory, setSelectedCaseCategory] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentStep === 2) form.setFieldsValue({ schedule: undefined });
  }, [watchedStaffId, form, visible, currentStep]);

  // Fetch initial data (staff, offices) for the dropdowns when the modal opens
  useEffect(() => {
    if (visible && user?.role) {
      const fetchData = async () => {
        try {
          const [availableStaff, availableOffices, availableClients] = await Promise.all([
            WorkflowService.listStaff(user.role),
            WorkflowService.listOffices(user.role),
            WorkflowService.listClients(user.role, '', 10),
          ]);
          setStaffList(availableStaff);
          setOffices(user.role === 'admin'
            ? availableOffices
            : availableOffices.filter((office) => office.id === user.officeId));
          const formattedClients = availableClients.map((client) => ({
            value: `${client.firstName} ${client.lastName} (${client.email})`,
            label: `${client.firstName} ${client.lastName} (${client.email})`,
            key: client.id,
          }));
          setRecentClients(formattedClients);
          setClientOptions(formattedClients);
        } catch (error) {
          console.error('Failed to load staff/offices:', error);
          message.error('No se pudieron cargar los datos necesarios.');
        }
      };
      fetchData();
      // Reset all state variables when the modal opens for a clean slate.
      setCurrentStep(0);
      setClientMode('existing');
      setCaseMode('existing');
      setSelectedClientLabel('');
      setClientInputValue('');
      setSelectedCaseCategory(null);
      setCases([]);
      form.resetFields();

      // Every non-admin employee creates records only within their assigned office.
      if (user.role !== 'admin' && user.officeId) {
        form.setFieldsValue({ officeId: user.officeId });
      }

      // If we have an existing appointment, pre-select the client and case
      if (existingAppointment) {
        form.setFieldsValue({ clientId: existingAppointment.clientId, caseId: existingAppointment.caseId });
        setCurrentStep(2); // Skip to appointment details
      }
    }
  }, [visible, form, existingAppointment, user]);

  // Fetch a client's existing cases whenever clientId changes
  useEffect(() => {
    const clientId = watchedClientId as number | undefined;
    if (clientId) {
      (async () => {
        try {
          if (!user) return;
          const list = await WorkflowService.listClientCases(user.role, clientId);
          setCases(list);
          
          if (list.length === 0) {
            message.info({
              content: 'Este cliente no tiene casos activos disponibles para citas. Puede crear un caso nuevo.',
              duration: 5
            });
          }
        } catch (error: any) {
          console.error('❌ Error fetching client cases:', error);
          const errorMessage = error.response?.data?.error || error.message || 'Error desconocido';
          message.error(`No se pudieron cargar los casos: ${errorMessage}`);
          setCases([]);
        }
      })();
    } else {
      setCases([]);
      form.setFieldsValue({ caseId: undefined });
    }
  }, [watchedClientId, form, user]);

  // Handle live searching for clients as the user types
  const handleClientSearch = async (searchText: string) => {
    setClientInputValue(searchText);
    // Show all recent clients when input is empty or very short
    if (!searchText || searchText.length < 2) { 
      setClientOptions(recentClients); 
      return; 
    }
    
    if (!user) return;
    setIsSearching(true);
    try {
      const clients = await WorkflowService.listClients(user.role, searchText, 10);
      const formattedOptions = clients.map((client) => ({
        value: `${client.firstName} ${client.lastName} (${client.email})`,
        label: `${client.firstName} ${client.lastName} (${client.email})`,
        key: client.id,
      }));
      setClientOptions(formattedOptions);
    } catch (error) { 
      console.error('Client search failed:', error);
      // Fallback to recent clients on error
      setClientOptions(recentClients);
    } finally {
      setIsSearching(false);
    }
  };

  // Show all clients when the input is focused (clicked)
  const handleClientFocus = () => {
    if (!clientInputValue && recentClients.length > 0) {
      setClientOptions(recentClients);
    }
  };

  const handleClientSelect = (value: string, option: any) => {
    setSelectedClientLabel(value);
    setClientInputValue(value);
    form.setFieldsValue({ clientId: option.key, clientSearch: value });
  };

  const handleClientChange = (val: string) => {
    setClientInputValue(val);
    if (val !== selectedClientLabel) {
      // User changed the text after selecting: clear the selected id
      setSelectedClientLabel('');
      form.setFieldsValue({ clientId: undefined });
    }
  };

  const handleClientBlur = () => {
    const clientId = form.getFieldValue('clientId');
    if (clientMode === 'existing' && !clientId) {
      form.setFields([
        { name: 'clientSearch', errors: ['Debe seleccionar un cliente de la lista'] },
      ]);
    }
  };

  // Determines the case category from the title to enable staff filtering
  const handleCaseTitleChange = (value: string) => {
    // Use the shared case taxonomy to determine department
    const department = findDepartmentByCaseType(value) || 'General';
    // Automatically set the department based on case type selection
    form.setFieldsValue({ department, staffId: undefined });
    setSelectedCaseCategory(department);
  };

  // A memoized, filtered list of staff based on the selected case category
  const filteredStaffList = useMemo(() => {
    const categoryToUse = selectedCaseCategory || watchedDepartment;
    
    if (!categoryToUse || categoryToUse === 'General') {
      return staffList;
    }
    
    // Get allowed roles for this case category using centralized configuration
    const allowedRoles = getRolesForCaseCategory(categoryToUse);
    
    // Admins should only appear for legal cases (Familiar, Civil), not for psychology cases
    const isLegalCase = categoryToUse === 'Familiar' || categoryToUse === 'Civil';
    
    return staffList.filter(staff => {
      // Admins and office managers can be assigned to any appointment
      const isManagement = staff.role === 'admin' || staff.role === 'office_manager';
      const isAdminForLegal = isAdminRole(staff.role as StaffRoleKey) && isLegalCase;
      const hasAllowedRole = allowedRoles.includes(staff.role as StaffRoleKey);
      const hasMatchingDepartment = staff.department === categoryToUse;
      
      return isManagement || isAdminForLegal || hasAllowedRole || hasMatchingDepartment;
    });
  }, [selectedCaseCategory, staffList, watchedDepartment]);

  // Handle the final submission of the multi-step form
  const handleOk = async () => {
    setLoading(true);
    try {
      if (!user) throw new Error('Usuario no autenticado.');
      const validationFields: string[] = ['staffId', 'title', 'schedule', 'status'];
      
      if (clientMode === 'existing') {
        validationFields.push('clientSearch');
      } else {
        validationFields.push('firstName', 'lastName', 'email');
      }
      
      if (caseMode === 'existing') {
        validationFields.push('caseId');
      } else {
        validationFields.push('newCaseTitle', 'officeId');
      }
      
      const values = await form.validateFields(validationFields);
      const schedule = values.schedule as AppointmentSlot;
      const clientId = form.getFieldValue('clientId');
      if (clientMode === 'existing' && !clientId) {
        throw new Error('Por favor, seleccione un cliente de la lista.');
      }
      message.loading({ content: 'Guardando...', key: 'appt' });

      const payload: any = {
        staffId: values.staffId,
        title: values.title,
        startTime: schedule.startTime.toISOString(),
        endTime: schedule.endTime.toISOString(),
        timeZone: schedule.timeZone,
        status: values.status,
      };

      // Automatically include department and category for new cases
      if (caseMode === 'new') {
        const department = form.getFieldValue('department');
        payload.department = department;
        payload.category = department; // Category and department are the same for new cases
      } else if (caseMode === 'existing') {
        // For existing cases, use the case's category if available
        const selectedCase = cases.find(c => c.id === values.caseId);
        if (selectedCase && (selectedCase as any).category) {
          payload.category = (selectedCase as any).category;
          payload.department = (selectedCase as any).category;
        } else {
          // Fallback to a default category if case doesn't have one
          payload.category = 'General';
          payload.department = 'General';
        }
      }

      if (clientMode === 'existing') {
        payload.clientId = clientId;
      } else {
        payload.newClient = { firstName: values.firstName, lastName: values.lastName, email: values.email };
      }
      
      if (caseMode === 'existing') {
        payload.caseId = values.caseId;
      } else {
        payload.newCase = { title: values.newCaseTitle, description: values.newCaseDescription, officeId: values.officeId };
      }

      await WorkflowService.createAppointment(user.role, payload);
      
      message.success({ content: '¡Cita creada exitosamente!', key: 'appt' });
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.errorFields) return; // Ant Design renders field-level validation inline.
      if (error.response?.status === 409) {
        form.setFieldsValue({ schedule: undefined });
        setAvailabilityRevision((previous) => previous + 1);
      }
      console.error('Appointment creation error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Ocurrió un error al crear la cita.';
      message.error({ content: errorMessage, key: 'appt' });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <Form.Item label="Cliente">
              <Radio.Group onChange={(e) => setClientMode(e.target.value)} value={clientMode}>
                <Radio value="existing">Cliente Existente</Radio>
                <Radio value="new">Cliente Nuevo</Radio>
              </Radio.Group>
            </Form.Item>
            {clientMode === 'existing' ? (
              <Form.Item label="Buscar Cliente" name="clientSearch" rules={[{ required: true, message: 'Debe seleccionar un cliente' }]}>
                <>
                  <Form.Item name="clientId" hidden>
                    <Input type="hidden" />
                  </Form.Item>
                  <AutoComplete
                    options={clientOptions}
                    onSelect={handleClientSelect}
                    onSearch={handleClientSearch}
                    onFocus={handleClientFocus}
                    onBlur={handleClientBlur}
                    value={clientInputValue}
                    onChange={handleClientChange}
                    placeholder="Haga clic o escriba para buscar clientes..."
                    notFoundContent={isSearching ? <Spin size="small" /> : 'No se encontraron clientes'}
                    showSearch
                    filterOption={false}
                    style={{ width: '100%' }}
                    open={clientOptions.length > 0 || isSearching ? undefined : false}
                  />
                  <div style={{ marginTop: 6 }}>
                    <Text type={!form.getFieldValue('clientId') && clientMode === 'existing' ? 'danger' : 'secondary'}>
                      {!form.getFieldValue('clientId') && clientMode === 'existing' ? 'Debe seleccionar un cliente de la lista' : 'Seleccione un cliente de la lista desplegable'}
                    </Text>
                  </div>
                  {recentClients.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
                      💡 Clientes recientes disponibles en el dropdown
                    </div>
                  )}
                </>
              </Form.Item>
            ) : (
              <>
                <Form.Item name="firstName" label="Nombre(s)" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="email" label="Correo" rules={[{ required: true, type: 'email' }]}>
                  <Input />
                </Form.Item>
              </>
            )}
          </>
        );
      case 1:
        return (
          <>
            <Form.Item label="Caso">
              <Radio.Group onChange={(e) => setCaseMode(e.target.value)} value={caseMode}>
                <Radio value="existing">Caso Existente</Radio>
                <Radio value="new">Caso Nuevo</Radio>
              </Radio.Group>
            </Form.Item>
            {caseMode === 'existing' ? (
              <Form.Item name="caseId" label="Seleccionar Caso" rules={[{ required: true, message: 'Debe seleccionar un caso' }]}>
                <Select
                  placeholder="Seleccione un caso existente"
                  disabled={cases.length === 0}
                  showSearch
                  filterOption={(input, option) => (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())}
                  onChange={(caseId: number) => {
                    const selected = (cases as any[]).find((c: any) => c.id === caseId);
                    if (selected && selected.category) {
                      form.setFieldsValue({ department: selected.category, staffId: undefined, category: undefined });
                      setSelectedCaseCategory(selected.category);
                      // Don't auto-fill category - let user choose
                    }
                  }}
                >
                  {cases.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.title}
                    </Option>
                  ))}
                </Select>
                {cases.length === 0 && form.getFieldValue('clientId') && (
                  <div style={{ marginTop: 8, padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '6px' }}>
                    <div style={{ fontSize: '13px', color: '#856404', fontWeight: '600', marginBottom: '6px' }}>
                      ⚠️ No se encontraron casos activos para este cliente
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '8px' }}>
                      Los casos existentes pueden estar archivados, completados o cancelados.
                    </div>
                    <div style={{ fontSize: '11px', color: '#495057' }}>
                      <strong>Opciones disponibles:</strong>
                      <br />
                      • Seleccione &quot;Caso Nuevo&quot; para crear un caso fresco
                      <br />
                      • Verifique en la sección de Casos si existen casos archivados
                    </div>
                  </div>
                )}
              </Form.Item>
            ) : (
              <>
                <Form.Item name="newCaseTitle" label="Tipo de Caso" rules={[{ required: true, message: 'Debe seleccionar el tipo de caso' }]}>
                  <Select placeholder="Seleccione el tipo de caso" onChange={handleCaseTitleChange} showSearch optionFilterProp="children">
                    {Object.entries(CASE_TYPES).map(([dept, types]) => (
                      <Select.OptGroup key={dept} label={dept}>
                        {types.map((t) => (
                          <Option key={t} value={t}>{t}</Option>
                        ))}
                      </Select.OptGroup>
                    ))}
                    <Select.OptGroup label="Otro">
                      <Option value="Otro">Otro (Especifique en descripción)</Option>
                    </Select.OptGroup>
                  </Select>
                </Form.Item>
                <Form.Item name="department" hidden>
                  <Input type="hidden" />
                </Form.Item>
                <Form.Item name="officeId" label="Oficina" rules={[{ required: true, message: 'Debe seleccionar una oficina' }]}>
                  <Select
                    placeholder="Seleccione una oficina"
                    disabled={user?.role !== 'admin'}
                  >
                    {offices && offices.length > 0 && offices.map((o) => (
                      <Option key={o.id} value={o.id}>
                        {o.name}
                      </Option>
                    ))}
                    {user?.role !== 'admin' && user?.officeId && offices.length === 0 && (
                      <Option key={user.officeId} value={user.officeId}>Mi Oficina</Option>
                    )}
                  </Select>
                </Form.Item>
                <Form.Item name="newCaseDescription" label="Descripción Adicional">
                  <Input.TextArea rows={3} placeholder="Agregue detalles adicionales sobre el caso (opcional)" />
                </Form.Item>
              </>
            )}
          </>
        );
      case 2:
        return (
          <>
            <Form.Item name="title" label="Título de la Cita" rules={[{ required: true, message: 'Debe ingresar un título para la cita' }]}>
              <Input placeholder="Ej: Consulta inicial, Seguimiento, etc." />
            </Form.Item>
            <Form.Item name="staffId" label="Asignar a" rules={[{ required: true, message: 'Debe seleccionar un miembro del personal' }]}>
              <Select
                placeholder="Seleccione un miembro del personal"
                showSearch
                filterOption={(input, option) => (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())}
              >
                {filteredStaffList.map((s) => (
                  <Option key={s.id} value={s.id}>{`${s.firstName} ${s.lastName} (${getRoleDisplayName(s.role)})`}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="schedule" label="Fecha y Horario" rules={[
              { required: true, message: 'Seleccione un horario disponible en la agenda.' },
              { validator: async (_, schedule?: AppointmentSlot) => {
                if (!schedule) return;
                const staffId = form.getFieldValue('staffId');
                let busy;
                try {
                  busy = await loadEmployeeAvailability(staffId, schedule.startTime.startOf('day'), schedule.startTime.add(1, 'day').startOf('day'));
                } catch {
                  throw new Error('No se pudo verificar la disponibilidad. Intente nuevamente.');
                }
                const duration = schedule.endTime.diff(schedule.startTime, 'minute');
                if (!availableAppointmentSlots(schedule.startTime, duration, busy).some((slot) => slot.valueOf() === schedule.startTime.valueOf())) {
                  setAvailabilityRevision((previous) => previous + 1);
                  throw new Error('Este horario ya no está disponible. Actualice la agenda y seleccione otro.');
                }
              } },
            ]} validateTrigger={[]}>
              <AppointmentAvailabilityPicker
                key={`${watchedStaffId || 'unassigned'}:${availabilityRevision}`}
                staffId={watchedStaffId}
                employeeName={staffList.filter((member) => member.id === watchedStaffId).map((member) => `${member.firstName} ${member.lastName}`).join('')}
              />
            </Form.Item>
            <Form.Item name="status" label="Estado" rules={[{ required: true }]} initialValue={APPOINTMENT_STATUSES.CONFIRMED}>
              <Select>
                {APPOINTMENT_STATUS_OPTIONS.map(option => (
                  <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                ))}
              </Select>
            </Form.Item>
          </>
        );
      default:
        return null;
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 0 && clientMode === 'existing') {
      return !form.getFieldValue('clientId');
    }
    if (currentStep === 1 && caseMode === 'existing') {
      const caseId = form.getFieldValue('caseId');
      return !caseId;
    }
    return false;
  };

  return (
    <Modal
      title="Programar Cita"
      open={visible}
      onCancel={onClose}
      width={820}
      centered
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto', paddingRight: 4 } }}
      footer={
        <div className="flex justify-between">
          <div>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>← Anterior</Button>
            )}
          </div>
          <div className="space-x-2">
            {currentStep < 2 && (
              <Button
                type="primary"
                disabled={isNextDisabled()}
                onClick={() => {
                  const validationFields: string[] = [];
                  if (currentStep === 0) {
                    if (clientMode === 'existing') {
                      validationFields.push('clientSearch');
                    } else {
                      validationFields.push('firstName', 'lastName', 'email');
                    }
                  } else if (currentStep === 1) {
                    if (caseMode === 'existing') {
                      validationFields.push('caseId');
                    } else {
                      validationFields.push('newCaseTitle', 'officeId');
                    }
                  }
                  form.validateFields(validationFields).then(() => setCurrentStep(currentStep + 1));
                }}
              >
                Siguiente →
              </Button>
            )}
            {currentStep === 2 && (
              <Button type="primary" loading={loading} onClick={handleOk}>
                Programar Cita
              </Button>
            )}
          </div>
        </div>
      }
    >
      <Steps current={currentStep} className="mb-8">
        <Steps.Step title="Cliente" description="Seleccionar o crear cliente" />
        <Steps.Step title="Caso" description="Seleccionar o crear caso" />
        <Steps.Step title="Cita" description="Detalles de la cita" />
      </Steps>
      <Form form={form} layout="vertical">
        {renderStepContent()}
      </Form>
    </Modal>
  );
};

export default AppointmentModal;
