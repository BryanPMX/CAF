'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, DatePicker, Select, Button, Space, Tag, Statistic, Row, Col, message, Spin, Radio, Divider } from 'antd';
import { DownloadOutlined, BarChartOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { Office } from '@/app/lib/types';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

// --- TypeScript Interfaces ---
interface CaseReport {
  id: number;
  title: string;
  category: string;
  status: string;
  currentStage: string;
  clientName: string;
  officeName: string;
  assignedStaff: string;
  createdAt: string;
  updatedAt: string;
  docketNumber?: string;
  court?: string;
  description?: string;
}

interface AppointmentReport {
  id: number;
  title: string;
  caseTitle: string;
  clientName: string;
  staffName: string;
  startTime: string;
  endTime: string;
  status: string;
  category: string;
  department: string;
  createdAt: string;
}

interface ReportSummary {
  totalCases: number;
  totalAppointments: number;
  casesByStatus: { status: string; count: number }[];
  casesByDepartment: { department: string; count: number }[];
  appointmentsByStatus: { status: string; count: number }[];
  appointmentsByDepartment: { department: string; count: number }[];
  casesByStage: { stage: string; count: number }[];
}

const ReportsPage = () => {
  const isHydrated = useHydrationSafe();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'cases' | 'appointments' | 'summary'>('summary');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'yearly'>('daily');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [department, setDepartment] = useState<string>('');
  const [officeId, setOfficeId] = useState<string>('');
  const [caseStatus, setCaseStatus] = useState<string>('');
  const [appointmentStatus, setAppointmentStatus] = useState<string>('');
  
  // Data states
  const [casesData, setCasesData] = useState<CaseReport[]>([]);
  const [appointmentsData, setAppointmentsData] = useState<AppointmentReport[]>([]);
  const [summaryData, setSummaryData] = useState<ReportSummary | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  
  // UI states
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration to complete
    
    const r = localStorage.getItem('userRole');
    setRole(r);
  }, [isHydrated]);

  // Load offices when component mounts
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const response = await apiClient.get('/offices');
        setOffices(response.data);
      } catch (error) {
        console.error('Error loading offices:', error);
        message.error('No se pudieron cargar las oficinas');
      }
    };
    fetchOffices();
  }, []);

  const loadReport = async () => {
    if (!dateRange) {
      message.warning('Por favor seleccione un rango de fechas para generar el reporte');
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('dateFrom', dateRange[0].toISOString());
      params.append('dateTo', dateRange[1].toISOString());
      params.append('period', period);
      
      if (department) params.append('department', department);
      if (officeId) params.append('officeId', officeId);
      if (caseStatus) params.append('caseStatus', caseStatus);
      if (appointmentStatus) params.append('appointmentStatus', appointmentStatus);

      const base = getReportsBase();
      
      switch (reportType) {
        case 'cases':
          const casesRes = await apiClient.get(`${base}/cases-report?${params}`);
          setCasesData(casesRes.data?.data || []);
          break;
        case 'appointments':
          const appointmentsRes = await apiClient.get(`${base}/appointments-report?${params}`);
          setAppointmentsData(appointmentsRes.data?.data || []);
          break;
        case 'summary':
          const summaryRes = await apiClient.get(`${base}/summary-report?${params}`);
          setSummaryData(summaryRes.data);
          break;
      }
      
      message.success('Reporte generado exitosamente');
    } catch (error) {
      console.error('Error loading report:', error);
      message.error('Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const getReportsBase = () => {
    return role === 'office_manager' ? '/manager/reports' : '/admin/reports';
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!dateRange) {
      message.warning('Seleccione un rango de fechas para exportar');
      return;
    }

    try {
      message.loading({ content: `Generando reporte en formato ${format.toUpperCase()}...`, key: 'export' });
      
      const params = new URLSearchParams();
      params.append('dateFrom', dateRange[0].toISOString());
      params.append('dateTo', dateRange[1].toISOString());
      params.append('period', period);
      params.append('format', format);
      params.append('reportType', reportType);
      
      if (department) params.append('department', department);
      if (officeId) params.append('officeId', officeId);
      if (caseStatus) params.append('caseStatus', caseStatus);
      if (appointmentStatus) params.append('appointmentStatus', appointmentStatus);

      const base = getReportsBase();
      const response = await apiClient.get(`${base}/export?${params}`, {
        responseType: 'blob',
        headers: {
          'Accept': format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
        }
      });

      // Validate blob data
      if (!response.data || response.data.size === 0) {
        throw new Error('El archivo generado está vacío o corrupto');
      }

      // Create download link with professional filename and proper MIME type
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm');
      const filename = `CAF_Reporte_${reportType}_${period}_${timestamp}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      
      // Create blob with proper MIME type
      const mimeType = format === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      
      // Create and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      message.success({ content: `Reporte exportado exitosamente: ${filename}`, key: 'export' });
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al exportar el reporte';
      message.error({ content: `Error al exportar: ${errorMessage}`, key: 'export' });
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'daily': return 'Diario';
      case 'weekly': return 'Semanal';
      case 'yearly': return 'Anual';
      default: return 'Diario';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'blue';
      case 'active': return 'green';
      case 'resolved': return 'green';
      case 'closed': return 'gray';
      case 'confirmed': return 'blue';
      case 'completed': return 'green';
      case 'cancelled': return 'red';
      case 'pending': return 'orange';
      default: return 'default';
    }
  };

  const getStageColor = (stage: string) => {
    const legalStages = ['etapa_inicial', 'notificacion', 'audiencia_preliminar', 'audiencia_juicio', 'sentencia'];
    if (legalStages.includes(stage)) return 'purple';
    
    const defaultStages = ['intake', 'initial_consultation', 'document_review', 'action_plan', 'resolution', 'closed'];
    if (defaultStages.includes(stage)) return 'blue';
    
    return 'default';
  };

  const getStageLabel = (stage: string) => {
    const stageLabels: { [key: string]: string } = {
      // Legal stages
      'etapa_inicial': 'Etapa Inicial',
      'notificacion': 'Notificación',
      'audiencia_preliminar': 'Audiencia Preliminar',
      'audiencia_juicio': 'Audiencia de Juicio',
      'sentencia': 'Sentencia',
      // Default stages
      'intake': 'Recepción',
      'initial_consultation': 'Consulta Inicial',
      'document_review': 'Revisión de Documentos',
      'action_plan': 'Plan de Acción',
      'resolution': 'Resolución',
      'closed': 'Cerrado'
    };
    return stageLabels[stage] || stage;
  };

  const calculateEnhancedStats = () => {
    if (!summaryData) return null;
    
    const totalCases = summaryData.totalCases;
    const totalAppointments = summaryData.totalAppointments;
    
    // Calculate completion rates
    const completedCases = summaryData.casesByStatus?.find(s => s.status === 'closed')?.count || 0;
    const completedAppointments = summaryData.appointmentsByStatus?.find(s => s.status === 'completed')?.count || 0;
    
    const caseCompletionRate = totalCases > 0 ? (completedCases / totalCases) * 100 : 0;
    const appointmentCompletionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
    
    return {
      caseCompletionRate: Math.round(caseCompletionRate * 100) / 100,
      appointmentCompletionRate: Math.round(appointmentCompletionRate * 100) / 100,
      activeCases: totalCases - completedCases,
      pendingAppointments: summaryData.appointmentsByStatus?.find(s => s.status === 'pending')?.count || 0
    };
  };

  const enhancedStats = calculateEnhancedStats();

  const handleDateRangeChange = (dates: any, dateStrings: [string, string]) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    } else {
      setDateRange(null);
    }
  };

  // Table columns for cases
  const caseColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Departamento',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'open' ? 'Abierto' : 
           status === 'active' ? 'Activo' : 
           status === 'resolved' ? 'Resuelto' : 
           status === 'closed' ? 'Cerrado' : status}
        </Tag>
      ),
    },
    {
      title: 'Fase',
      dataIndex: 'currentStage',
      key: 'currentStage',
      width: 150,
      render: (stage: string) => (
        <Tag color={getStageColor(stage)}>
          {getStageLabel(stage)}
        </Tag>
      ),
    },
    {
      title: 'Cliente',
      dataIndex: 'clientName',
      key: 'clientName',
      width: 150,
    },
    {
      title: 'Oficina',
      dataIndex: 'officeName',
      key: 'officeName',
      width: 120,
    },
    {
      title: 'Personal Asignado',
      dataIndex: 'assignedStaff',
      key: 'assignedStaff',
      width: 150,
    },
    {
      title: 'N° Expediente',
      dataIndex: 'docketNumber',
      key: 'docketNumber',
      width: 120,
      render: (docketNumber: string) => docketNumber || '-',
    },
    {
      title: 'Juzgado',
      dataIndex: 'court',
      key: 'court',
      width: 120,
      render: (court: string) => court || '-',
    },
    {
      title: 'Fecha Creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Última Actualización',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
  ];

  // Table columns for appointments
  const appointmentColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Caso',
      dataIndex: 'caseTitle',
      key: 'caseTitle',
      ellipsis: true,
    },
    {
      title: 'Cliente',
      dataIndex: 'clientName',
      key: 'clientName',
      width: 150,
    },
    {
      title: 'Personal',
      dataIndex: 'staffName',
      key: 'staffName',
      width: 150,
    },
    {
      title: 'Fecha Inicio',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 120,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Fecha Fin',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 120,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'confirmed' ? 'Confirmada' : 
           status === 'completed' ? 'Completada' : 
           status === 'cancelled' ? 'Cancelada' : 
           status === 'pending' ? 'Pendiente' : status}
        </Tag>
      ),
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: 'Departamento',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: 'Fecha Creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reportes del Sistema</h1>
        <Space>
          <Button 
            type="primary" 
            icon={<FileExcelOutlined />} 
            onClick={() => handleExport('excel')}
            disabled={!dateRange || loading}
          >
            Exportar Excel
          </Button>
          <Button 
            type="primary" 
            icon={<FilePdfOutlined />} 
            onClick={() => handleExport('pdf')}
            disabled={!dateRange || loading}
          >
            Exportar PDF
          </Button>
        </Space>
      </div>

      {/* Report Configuration */}
      <Card className="mb-6">
        <Row gutter={16}>
          <Col span={6}>
            <div className="mb-2 font-medium">Tipo de Reporte</div>
            <Radio.Group value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <Radio.Button value="summary">Resumen General</Radio.Button>
              <Radio.Button value="cases">Casos</Radio.Button>
              <Radio.Button value="appointments">Citas</Radio.Button>
            </Radio.Group>
          </Col>
          <Col span={6}>
            <div className="mb-2 font-medium">Período</div>
            <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)}>
              <Radio.Button value="daily">Diario</Radio.Button>
              <Radio.Button value="weekly">Semanal</Radio.Button>
              <Radio.Button value="yearly">Anual</Radio.Button>
            </Radio.Group>
          </Col>
          <Col span={6}>
            <div className="mb-2 font-medium">
              Rango de Fechas <span className="text-red-500">*</span>
            </div>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              placeholder={['Fecha inicio', 'Fecha fin']}
            />
          </Col>
          <Col span={6}>
            <div className="mb-2 font-medium">Departamento</div>
            <Select
              placeholder="Todos los departamentos"
              value={department}
              onChange={setDepartment}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="Familiar">Familiar</Option>
              <Option value="Civil">Civil</Option>
              <Option value="Psicologia">Psicología</Option>
              <Option value="Recursos">Recursos</Option>
            </Select>
          </Col>
        </Row>

        <Divider />

        <Row gutter={16}>
          <Col span={6}>
            <div className="mb-2 font-medium">Oficina</div>
            <Select
              placeholder="Todas las oficinas"
              value={officeId}
              onChange={setOfficeId}
              allowClear
              style={{ width: '100%' }}
            >
              {offices.map((office) => (
                <Option key={office.id} value={office.id.toString()}>
                  {office.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <div className="mb-2 font-medium">Estado del Caso</div>
            <Select
              placeholder="Todos los estados"
              value={caseStatus}
              onChange={setCaseStatus}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="open">Abierto</Option>
              <Option value="active">Activo</Option>
              <Option value="resolved">Resuelto</Option>
              <Option value="closed">Cerrado</Option>
            </Select>
          </Col>
          <Col span={6}>
            <div className="mb-2 font-medium">Estado de la Cita</div>
            <Select
              placeholder="Todos los estados"
              value={appointmentStatus}
              onChange={setAppointmentStatus}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="confirmed">Confirmada</Option>
              <Option value="completed">Completada</Option>
              <Option value="cancelled">Cancelada</Option>
              <Option value="pending">Pendiente</Option>
            </Select>
          </Col>
          <Col span={6}>
            <div className="mb-2 font-medium">Acciones</div>
            <Button 
              type="primary" 
              icon={<BarChartOutlined />} 
              onClick={loadReport}
              loading={loading}
              disabled={!dateRange}
            >
              Generar Reporte
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Report Content */}
      {loading ? (
        <Card>
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">Generando reporte...</div>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary Report */}
          {reportType === 'summary' && summaryData && (
            <Card title={`Resumen General - ${getPeriodLabel()}`} className="mb-6">
              {/* Enhanced Statistics Row */}
              <Row gutter={16} className="mb-6">
                <Col span={6}>
                  <Card size="small" className="text-center border-l-4 border-l-blue-500">
                    <Statistic
                      title="Total de Casos"
                      value={summaryData.totalCases}
                      prefix={<BarChartOutlined className="text-blue-500" />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="text-center border-l-4 border-l-green-500">
                    <Statistic
                      title="Total de Citas"
                      value={summaryData.totalAppointments}
                      prefix={<BarChartOutlined className="text-green-500" />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="text-center border-l-4 border-l-purple-500">
                    <Statistic
                      title="Casos Activos"
                      value={enhancedStats?.activeCases || 0}
                      prefix={<BarChartOutlined className="text-purple-500" />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="text-center border-l-4 border-l-orange-500">
                    <Statistic
                      title="Citas Pendientes"
                      value={enhancedStats?.pendingAppointments || 0}
                      prefix={<BarChartOutlined className="text-orange-500" />}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Unified Cases and Appointments Table */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-4">Resumen Unificado de Casos y Citas</h4>
                
                {/* Cases Summary Table */}
                <Card title="Casos por Estado y Fase" size="small" className="mb-4">
                  <Row gutter={16}>
                    <Col span={12}>
                      <h5 className="font-medium mb-3">Casos por Estado</h5>
                      <div className="space-y-2">
                        {summaryData.casesByStatus.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-medium">
                              {item.status === 'open' ? 'Abierto' : 
                               item.status === 'active' ? 'Activo' : 
                               item.status === 'resolved' ? 'Resuelto' : 
                               item.status === 'closed' ? 'Cerrado' : item.status}
                            </span>
                            <Tag color="blue" className="font-bold">{item.count}</Tag>
                          </div>
                        ))}
                      </div>
                    </Col>
                    <Col span={12}>
                      <h5 className="font-medium mb-3">Casos por Fase</h5>
                      <div className="space-y-2">
                        {summaryData?.casesByStage?.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-medium">{getStageLabel(item.stage)}</span>
                            <Tag color="orange" className="font-bold">{item.count}</Tag>
                          </div>
                        )) || <div className="text-gray-500">No hay datos de fases</div>}
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* Appointments Summary Table */}
                <Card title="Citas por Estado y Departamento" size="small" className="mb-4">
                  <Row gutter={16}>
                    <Col span={12}>
                      <h5 className="font-medium mb-3">Citas por Estado</h5>
                      <div className="space-y-2">
                        {summaryData?.appointmentsByStatus?.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-medium">
                              {item.status === 'confirmed' ? 'Confirmada' : 
                               item.status === 'completed' ? 'Completada' : 
                               item.status === 'cancelled' ? 'Cancelada' : 
                               item.status === 'pending' ? 'Pendiente' : item.status}
                            </span>
                            <Tag color="purple" className="font-bold">{item.count}</Tag>
                          </div>
                        )) || <div className="text-gray-500">No hay datos de citas</div>}
                      </div>
                    </Col>
                    <Col span={12}>
                      <h5 className="font-medium mb-3">Casos por Departamento</h5>
                      <div className="space-y-2">
                        {summaryData.casesByDepartment.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-medium">{item.department}</span>
                            <Tag color="green" className="font-bold">{item.count}</Tag>
                          </div>
                        ))}
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* Performance Metrics */}
                <Card title="Métricas de Rendimiento" size="small">
                  <Row gutter={16}>
                    <Col span={12}>
                      <div className="text-center p-4 bg-blue-50 rounded">
                        <div className="text-2xl font-bold text-blue-600">
                          {enhancedStats?.caseCompletionRate || 0}%
                        </div>
                        <div className="text-blue-600 font-medium">Tasa de Completación de Casos</div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="text-center p-4 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {enhancedStats?.appointmentCompletionRate || 0}%
                        </div>
                        <div className="text-green-600 font-medium">Tasa de Completación de Citas</div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              </div>
            </Card>
          )}

          {/* Cases Report */}
          {reportType === 'cases' && casesData.length > 0 && (
            <Card title={`Reporte de Casos - ${getPeriodLabel()}`}>
              <div className="mb-4">
                <span className="text-gray-600">
                  Total de casos: <strong>{casesData.length}</strong>
                </span>
              </div>
              <Table
                columns={caseColumns}
                dataSource={casesData}
                rowKey="id"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} casos`,
                }}
                scroll={{ x: 1200 }}
              />
            </Card>
          )}

          {/* Appointments Report */}
          {reportType === 'appointments' && appointmentsData.length > 0 && (
            <Card title={`Reporte de Citas - ${getPeriodLabel()}`}>
              <div className="mb-4">
                <span className="text-gray-600">
                  Total de citas: <strong>{appointmentsData.length}</strong>
                </span>
              </div>
              <Table
                columns={appointmentColumns}
                dataSource={appointmentsData}
                rowKey="id"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} citas`,
                }}
                scroll={{ x: 1200 }}
              />
            </Card>
          )}

          {/* No Data Message */}
          {!loading && !summaryData && casesData.length === 0 && appointmentsData.length === 0 && (
            <Card>
              <div className="text-center py-8 text-gray-500">
                <BarChartOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div className="text-lg">No hay datos para mostrar</div>
                <div className="text-sm">Seleccione un rango de fechas y haga clic en &quot;Generar Reporte&quot; para ver los datos</div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
