// admin-portal/src/app/(dashboard)/components/AppointmentModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Button, message, Select, DatePicker, Radio, AutoComplete, Steps, Spin } from 'antd';
import { apiClient } from '../../lib/api';
import dayjs from 'dayjs';

const { Option } = Select;

// --- TypeScript Interfaces for data clarity ---
interface Case { id: number; title: string; }
interface StaffMember { id: number; firstName: string; lastName: string; role: string; }
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
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedCaseCategory, setSelectedCaseCategory] = useState<string | null>(null);

  // Fetch initial data (staff, offices) for the dropdowns when the modal opens
  useEffect(() => {
    if (visible) {
      const fetchData = async () => {
        try {
          const [staffRes, officesRes] = await Promise.all([
            apiClient.get('/admin/users'),
            apiClient.get('/admin/offices'),
          ]);
          setStaffList(staffRes.data.filter((user: any) => user.role !== 'client'));
          setOffices(officesRes.data);
        } catch (error) { message.error('No se pudieron cargar los datos necesarios.'); }
      };
      fetchData();
      loadRecentClients();
      // Reset all state variables when the modal opens for a clean slate.
      setCurrentStep(0);
      setClientMode('existing');
      setCaseMode('existing');
      setSelectedClientId(null);
      setSelectedCaseCategory(null);
      form.resetFields();

      // If we have an existing appointment, pre-select the client and case
      if (existingAppointment) {
        setSelectedClientId(existingAppointment.clientId);
        setCurrentStep(2); // Skip to appointment details
      }
    }
  }, [visible, form]);

  // Fetch a client's existing cases when a client is selected from the search
  useEffect(() => {
    if (selectedClientId) {
      const fetchClientCases = async () => {
        try {
          const response = await apiClient.get(`/admin/clients/${selectedClientId}/cases`);
          setCases(response.data || []);
        } catch (error) { message.error("No se pudieron cargar los casos de este cliente."); }
      };
      fetchClientCases();
    }
  }, [selectedClientId]);

  // Handle live searching for clients as the user types
  const handleClientSearch = async (searchText: string) => {
    if (!searchText || searchText.length < 2) { 
      setClientOptions(recentClients); 
      return; 
    }
    
    setIsSearching(true);
    try {
      const response = await apiClient.get(`/admin/users/search?q=${searchText}`);
      const formattedOptions = response.data.map((client: any) => ({
        value: `${client.firstName} ${client.lastName} (${client.email})`,
        label: `${client.firstName} ${client.lastName} (${client.email})`,
        key: client.id,
      }));
      setClientOptions(formattedOptions);
    } catch (error) { 
      console.error("Client search failed:", error);
      message.error('Error al buscar clientes');
    } finally {
      setIsSearching(false);
    }
  };

  // Load recent clients on modal open
  const loadRecentClients = async () => {
    try {
      const response = await apiClient.get('/admin/users?limit=10&role=client');
      const formattedOptions = response.data.map((client: any) => ({
        value: `${client.firstName} ${client.lastName} (${client.email})`,
        label: `${client.firstName} ${client.lastName} (${client.email})`,
        key: client.id,
      }));
      setRecentClients(formattedOptions);
      setClientOptions(formattedOptions);
    } catch (error) {
      console.error("Failed to load recent clients:", error);
    }
  };

  const handleClientSelect = (value: string, option: any) => {
    setSelectedClientId(option.key);
  };

  // Determines the case category from the title to enable staff filtering
  const handleCaseTitleChange = (value: string) => {
    if (value.toLowerCase().includes('legal')) setSelectedCaseCategory('lawyer');
    else if (value.toLowerCase().includes('psicológica')) setSelectedCaseCategory('psychologist');
    else setSelectedCaseCategory('general');
    form.setFieldsValue({ staffId: undefined });
  };

  // A memoized, filtered list of staff based on the selected case category
  const filteredStaffList = useMemo(() => {
    if (!selectedCaseCategory || selectedCaseCategory === 'general') return staffList;
    return staffList.filter(staff => staff.role === selectedCaseCategory || staff.role === 'admin');
  }, [selectedCaseCategory, staffList]);

  // Handle the final submission of the multi-step form
  const handleOk = async () => {
    try {
      // Validate only the fields that are currently visible
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
      setLoading(true);
      message.loading({ content: 'Guardando...', key: 'appt' });

      const payload: any = {
        staffId: values.staffId,
        title: values.title,
        startTime: values.startTime.toISOString(),
        endTime: values.endTime.toISOString(),
        status: values.status,
      };

      if (clientMode === 'existing') {
        if (!selectedClientId) throw new Error('Por favor, seleccione un cliente de la lista.');
        payload.clientId = selectedClientId;
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

  // Renders the appropriate form fields for the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Step 1: Client Selection
        return (
          <>
            <Form.Item label="Cliente">
              <Radio.Group onChange={(e) => setClientMode(e.target.value)} value={clientMode}>
                <Radio value="existing">Cliente Existente</Radio>
                <Radio value="new">Cliente Nuevo</Radio>
              </Radio.Group>
            </Form.Item>
            {clientMode === 'existing' ? (
              <Form.Item label="Buscar Cliente" name="clientSearch" rules={[{ required: true, message: "Debe seleccionar un cliente"}]}>
                <AutoComplete 
                  options={clientOptions} 
                  onSelect={handleClientSelect} 
                  onSearch={handleClientSearch} 
                  placeholder="Escriba el nombre o correo del cliente..."
                  notFoundContent={isSearching ? <Spin size="small" /> : "No se encontraron clientes"}
                  showSearch
                  filterOption={false}
                  style={{ width: '100%' }}
                />
                {recentClients.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    💡 Clientes recientes disponibles en el dropdown
                  </div>
                )}
              </Form.Item>
            ) : (
              <>
                <Form.Item name="firstName" label="Nombre(s)" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="email" label="Correo" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
              </>
            )}
          </>
        );
      case 1: // Step 2: Case Selection
        return (
          <>
            <Form.Item label="Caso">
              <Radio.Group onChange={(e) => setCaseMode(e.target.value)} value={caseMode}>
                <Radio value="existing">Caso Existente</Radio>
                <Radio value="new">Caso Nuevo</Radio>
              </Radio.Group>
            </Form.Item>
            {caseMode === 'existing' ? (
              <Form.Item name="caseId" label="Seleccionar Caso" rules={[{ required: true, message: "Debe seleccionar un caso" }]}>
                <Select 
                  placeholder="Seleccione un caso existente" 
                  disabled={cases.length === 0}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {cases.map(c => <Option key={c.id} value={c.id}>{c.title}</Option>)}
                </Select>
                {cases.length === 0 && selectedClientId && (
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    ℹ️ Este cliente no tiene casos existentes. Seleccione "Caso Nuevo" para crear uno.
                  </div>
                )}
              </Form.Item>
            ) : (
              <>
                <Form.Item name="newCaseTitle" label="Tipo de Caso" rules={[{ required: true, message: "Debe seleccionar el tipo de caso" }]}>
                  <Select placeholder="Seleccione el tipo de caso" onChange={handleCaseTitleChange}>
                    <Option value="Consulta Legal - Familiar">⚖️ Consulta Legal - Familiar</Option>
                    <Option value="Consulta Psicológica - Individual">🧠 Consulta Psicológica - Individual</Option>
                    <Option value="Asistencia Social - Recursos">🤝 Asistencia Social - Recursos</Option>
                    <Option value="Otro">📋 Otro (Especifique en descripción)</Option>
                  </Select>
                </Form.Item>
                <Form.Item name="officeId" label="Oficina" rules={[{ required: true, message: "Debe seleccionar una oficina" }]}>
                  <Select placeholder="Seleccione una oficina">
                    {offices.map(o => <Option key={o.id} value={o.id}>{o.name}</Option>)}
                  </Select>
                </Form.Item>
                <Form.Item name="newCaseDescription" label="Descripción Adicional">
                  <Input.TextArea 
                    rows={3} 
                    placeholder="Agregue detalles adicionales sobre el caso (opcional)"
                  />
                </Form.Item>
              </>
            )}
          </>
        );
      case 2: // Step 3: Appointment Details
        return (
          <>
            <Form.Item name="title" label="Título de la Cita" rules={[{ required: true, message: "Debe ingresar un título para la cita" }]}>
              <Input placeholder="Ej: Consulta inicial, Seguimiento, etc." />
            </Form.Item>
            <Form.Item name="staffId" label="Asignar a" rules={[{ required: true, message: "Debe seleccionar un miembro del personal" }]}>
              <Select 
                placeholder="Seleccione un miembro del personal"
                showSearch
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {filteredStaffList.map(s => <Option key={s.id} value={s.id}>{`${s.firstName} ${s.lastName} (${s.role})`}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="startTime" label="Fecha y Hora de Inicio" rules={[{ required: true, message: "Debe seleccionar la fecha y hora de inicio" }]}>
              <DatePicker 
                showTime={{ format: 'HH:mm' }} 
                format="DD/MM/YYYY HH:mm" 
                style={{ width: '100%' }}
                placeholder="Seleccione fecha y hora"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>
            <Form.Item name="endTime" label="Fecha y Hora de Fin" rules={[{ required: true, message: "Debe seleccionar la fecha y hora de fin" }]}>
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
              <Button onClick={() => setCurrentStep(currentStep - 1)}>
                ← Anterior
              </Button>
            )}
          </div>
          <div className="space-x-2">
            {currentStep < 2 && (
              <Button 
                type="primary" 
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
