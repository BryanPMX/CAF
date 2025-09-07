// admin-portal/src/app/(dashboard)/components/AppointmentModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Button, message, Select, DatePicker, Radio, AutoComplete, Steps, Spin, Typography } from 'antd';
import { apiClient } from '@/app/lib/api';
import { CASE_TYPES, findDepartmentByCaseType } from '@/app/lib/caseTaxonomy';
import { ROLE_LABELS, DEPARTMENT_ROLE_MAPPING, getRoleLabel, getRolesForCaseCategory, isAdminRole } from '@/config/roles';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;

// --- TypeScript Interfaces for data clarity ---
interface Case { id: number; title: string; }
interface StaffMember { id: number; firstName: string; lastName: string; role: string; department?: string; email: string; }
interface Office { id: number; name: string; }
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
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // --- State for data fetched from the API ---
  const [cases, setCases] = useState<Case[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientSearchResult[]>([]);
  const [recentClients, setRecentClients] = useState<ClientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- State for user selections and filtering ---
  const [clientMode, setClientMode] = useState('existing');
  const [caseMode, setCaseMode] = useState('existing');
  const [selectedClientLabel, setSelectedClientLabel] = useState<string>('');
  const [clientInputValue, setClientInputValue] = useState<string>('');
  const [selectedCaseCategory, setSelectedCaseCategory] = useState<string | null>(null);

  // Fetch initial data (staff, offices) for the dropdowns when the modal opens
  useEffect(() => {
    if (visible) {
      const fetchData = async () => {
        try {
          const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'admin';
          const base = role === 'office_manager' ? '/manager' : '/admin';
          const [staffRes, officesRes] = await Promise.all([
            apiClient.get(`${base}/users`),
            apiClient.get('/offices'),
          ]);
          const staffPayload = Array.isArray(staffRes.data)
            ? staffRes.data
            : (staffRes.data?.users || []);
          const filteredStaff = staffPayload.filter((user: any) => user.role !== 'client');
          setStaffList(filteredStaff);
          setOffices(officesRes.data);
        } catch (error) { message.error('No se pudieron cargar los datos necesarios.'); }
      };
      fetchData();
      loadRecentClients();
      // Reset all state variables when the modal opens for a clean slate.
      setCurrentStep(0);
      setClientMode('existing');
      setCaseMode('existing');
      setSelectedClientLabel('');
      setClientInputValue('');
      setSelectedCaseCategory(null);
      setCases([]);
      form.resetFields();

      // Prefill office for office managers (and any user with stored office)
      if (typeof window !== 'undefined') {
        const officeId = localStorage.getItem('userOfficeId');
        if (officeId) {
          form.setFieldsValue({ officeId: Number(officeId) });
        }
      }

      // If we have an existing appointment, pre-select the client and case
      if (existingAppointment) {
        form.setFieldsValue({ clientId: existingAppointment.clientId });
        setCurrentStep(2); // Skip to appointment details
      }
    }
  }, [visible, form, existingAppointment]);

  // Fetch a client's existing cases whenever clientId changes
  useEffect(() => {
    const clientId = watchedClientId as number | undefined;
    if (clientId) {
      (async () => {
        try {
          const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'admin';
          const base = role === 'office_manager' ? '/manager' : '/admin';
          
          console.log(`🔍 Fetching cases for client ${clientId} from: ${base}/clients/${clientId}/cases-for-appointment`);
          
          const response = await apiClient.get(`${base}/clients/${clientId}/cases-for-appointment`);
          const data = response.data;
          
          console.log('📋 Cases API response:', data);
          
          const list = Array.isArray(data) ? data : (data?.cases || []);
          setCases(list);
          
          // Enhanced debugging information
          if (data?.debug) {
            console.log('🔍 Debug info:', data.debug);
          }
          
          if (list.length === 0) {
            console.log('⚠️ No cases found for this client');
            console.log('🔍 Possible reasons: cases may be archived, deleted, or cancelled');
            message.info({
              content: 'Este cliente no tiene casos activos disponibles para citas. Puede crear un caso nuevo.',
              duration: 5
            });
          } else {
            console.log(`✅ Found ${list.length} cases for client:`, list.map(c => ({ id: c.id, title: c.title, status: c.status })));
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
  }, [watchedClientId, form]);

  // Handle live searching for clients as the user types
  const handleClientSearch = async (searchText: string) => {
    setClientInputValue(searchText);
    if (!searchText || searchText.length < 2) { 
      setClientOptions(recentClients); 
      return; 
    }
    
    setIsSearching(true);
    try {
      const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'admin';
      const base = role === 'office_manager' ? '/manager' : '/admin';
      const response = await apiClient.get(`${base}/users/search?q=${searchText}`);
      const formattedOptions = response.data.map((client: any) => ({
        value: `${client.firstName} ${client.lastName} (${client.email})`,
        label: `${client.firstName} ${client.lastName} (${client.email})`,
        key: client.id,
      }));
      setClientOptions(formattedOptions);
    } catch (error) { 
      console.error('Client search failed:', error);
      message.error('Error al buscar clientes');
    } finally {
      setIsSearching(false);
    }
  };

  // Load recent clients on modal open
  const loadRecentClients = async () => {
    try {
      const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'admin';
      const base = role === 'office_manager' ? '/manager' : '/admin';
      const response = await apiClient.get(`${base}/users?limit=10&role=client`);
      const recentClientsPayload = Array.isArray(response.data)
        ? response.data
        : (response.data?.users || []);
      const formattedOptions = recentClientsPayload.map((client: any) => ({
        value: `${client.firstName} ${client.lastName} (${client.email})`,
        label: `${client.firstName} ${client.lastName} (${client.email})`,
        key: client.id,
      }));
      setRecentClients(formattedOptions);
      setClientOptions(formattedOptions);
    } catch (error) {
      console.error('Failed to load recent clients:', error);
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
    
    if (!categoryToUse || categoryToUse === 'General') return staffList;
    
    // Get allowed roles for this case category using centralized configuration
    const allowedRoles = getRolesForCaseCategory(categoryToUse);
    
    // Admins should only appear for legal cases (Familiar, Civil), not for psychology cases
    const isLegalCase = categoryToUse === 'Familiar' || categoryToUse === 'Civil';
    
    const filtered = staffList.filter(staff => {
      const isAdmin = isAdminRole(staff.role) && isLegalCase; // Only show admins for legal cases
      const hasAllowedRole = allowedRoles.includes(staff.role);
      const hasMatchingDepartment = staff.department === categoryToUse;
      
      return isAdmin || hasAllowedRole || hasMatchingDepartment;
    });
    
    return filtered;
  }, [selectedCaseCategory, staffList, watchedDepartment]);

  // Handle the final submission of the multi-step form
  const handleOk = async () => {
    try {
      const validationFields: string[] = ['staffId', 'title', 'startTime', 'endTime', 'status'];
      
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
      const clientId = form.getFieldValue('clientId');
      if (clientMode === 'existing' && !clientId) {
        throw new Error('Por favor, seleccione un cliente de la lista.');
      }
      setLoading(true);
      message.loading({ content: 'Guardando...', key: 'appt' });

      const payload: any = {
        staffId: values.staffId,
        title: values.title,
        startTime: values.startTime.toISOString(),
        endTime: values.endTime.toISOString(),
        status: values.status,
      };

      // Automatically include department for new cases
      if (caseMode === 'new') {
        payload.department = form.getFieldValue('department');
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

      await apiClient.post('/admin/appointments', payload);
      
      message.success({ content: '¡Cita creada exitosamente!', key: 'appt' });
      onSuccess();
      onClose();
    } catch (error: any) {
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
                    onBlur={handleClientBlur}
                    value={clientInputValue}
                    onChange={handleClientChange}
                    placeholder="Escriba el nombre o correo del cliente..."
                    notFoundContent={isSearching ? <Spin size="small" /> : 'No se encontraron clientes'}
                    showSearch
                    filterOption={false}
                    style={{ width: '100%' }}
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
                      • Seleccione "Caso Nuevo" para crear un caso fresco
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
                    disabled={typeof window !== 'undefined' && localStorage.getItem('userRole') === 'office_manager'}
                  >
                    {offices && offices.length > 0 && offices.map((o) => (
                      <Option key={o.id} value={o.id}>
                        {o.name}
                      </Option>
                    ))}
                    {typeof window !== 'undefined' && localStorage.getItem('userRole') === 'office_manager' && (() => {
                      const officeId = localStorage.getItem('userOfficeId');
                      return officeId ? <Option key={officeId} value={Number(officeId)}>Mi Oficina</Option> : null;
                    })()}
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
                  <Option key={s.id} value={s.id}>{`${s.firstName} ${s.lastName} (${getRoleLabel(s.role)})`}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="startTime" label="Fecha y Hora de Inicio" rules={[{ required: true, message: 'Debe seleccionar la fecha y hora de inicio' }]}>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%' }}
                placeholder="Seleccione fecha y hora"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>
            <Form.Item name="endTime" label="Fecha y Hora de Fin" rules={[{ required: true, message: 'Debe seleccionar la fecha y hora de fin' }]}>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%' }}
                placeholder="Seleccione fecha y hora"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>
            <Form.Item name="status" label="Estado" rules={[{ required: true }]} initialValue="confirmed">
              <Select>
                <Option value="confirmed">✅ Confirmada</Option>
                <Option value="pending">⏳ Pendiente</Option>
                <Option value="cancelled">❌ Cancelada</Option>
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
      width={700}
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
                ✅ Programar Cita
              </Button>
            )}
          </div>
        </div>
      }
    >
      <Steps current={currentStep} className="mb-8">
        <Steps.Step title="👤 Cliente" description="Seleccionar o crear cliente" />
        <Steps.Step title="📋 Caso" description="Seleccionar o crear caso" />
        <Steps.Step title="📅 Cita" description="Detalles de la cita" />
      </Steps>
      <Form form={form} layout="vertical">
        {renderStepContent()}
      </Form>
    </Modal>
  );
};

export default AppointmentModal;
