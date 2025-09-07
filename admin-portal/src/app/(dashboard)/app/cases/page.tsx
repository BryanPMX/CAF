'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  Table, 
  message, 
  Spin, 
  Tag, 
  Button, 
  Select, 
  Space, 
  Input, 
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Tooltip,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  EyeOutlined, 
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  BarChartOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import CreateCaseModal from './components/CreateCaseModal';
// Custom debounce implementation to avoid lodash dependency
const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): T => {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
};

// --- TypeScript Interfaces ---
interface Client {
  firstName?: string;
  lastName?: string;
}

interface Office {
  name?: string;
}

interface Case {
  id: number;
  title: string;
  status: string;
  category: string;
  currentStage: string;
  docketNumber?: string;
  court?: string;
  client?: Client | null;
  office?: Office | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  data: Case[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  performance: {
    queryTime: string;
    cacheHit: boolean;
    responseSize: number;
  };
}

// Performance-optimized cache manager
class CaseCache {
  private cache = new Map<string, { data: PaginatedResponse; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: PaginatedResponse): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  get(key: string): PaginatedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Helper functions
const getCaseStages = (category: string) => {
  if (category === 'Familiar' || category === 'Civil') {
    return [
      "etapa_inicial",
      "notificacion", 
      "audiencia_preliminar",
      "audiencia_juicio",
      "sentencia"
    ];
  }
  
  return [
    "intake", 
    "initial_consultation", 
    "document_review", 
    "action_plan", 
    "resolution", 
    "closed"
  ];
};

const getStageLabels = (category: string): { [key: string]: string } => {
  if (category === 'Familiar' || category === 'Civil') {
    return {
      "etapa_inicial": "Etapa Inicial",
      "notificacion": "Notificación",
      "audiencia_preliminar": "Audiencia Preliminar",
      "audiencia_juicio": "Audiencia de Juicio",
      "sentencia": "Sentencia",
    };
  }
  
  if (category === 'Psicologia') {
    return {
      "intake": "Recepción",
      "initial_consultation": "Consulta Inicial",
      "document_review": "Revisión de Documentos",
      "action_plan": "Plan de Acción",
      "resolution": "Resolución",
      "closed": "Cerrado",
    };
  }
  
  if (category === 'Recursos') {
    return {
      "intake": "Recepción",
      "initial_consultation": "Consulta Inicial",
      "document_review": "Revisión de Documentos",
      "action_plan": "Plan de Acción",
      "resolution": "Resolución",
      "closed": "Cerrado",
    };
  }
  
  return {
    "intake": "Recepción",
    "initial_consultation": "Consulta Inicial",
    "document_review": "Revisión de Documentos",
    "action_plan": "Plan de Acción",
    "resolution": "Resolución",
    "closed": "Cerrado",
  };
};

const CaseManagementPage = () => {
  // --- State Management ---
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string | undefined>(undefined);
  const [caseTypeFilter, setCaseTypeFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // --- Performance Optimizations ---
  const cache = useMemo(() => new CaseCache(), []);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((text: string) => {
      setDebouncedSearchText(text);
      setCurrentPage(1);
    }, 300),
    []
  );

  // Generate cache key
  const generateCacheKey = useCallback(() => {
    return `cases:${currentPage}:${pageSize}:${debouncedSearchText}:${deptFilter || ''}:${caseTypeFilter || ''}`;
  }, [currentPage, pageSize, debouncedSearchText, deptFilter, caseTypeFilter]);

  // Optimized data fetching with caching
  const fetchCases = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const cacheKey = generateCacheKey();
      const cachedData = cache.get(cacheKey);
      
      if (cachedData && !append) {
        setCases(cachedData.data);
        setTotal(cachedData.pagination.total);
        setPerformanceMetrics(cachedData.performance);
        setLoading(false);
        setError(null);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(debouncedSearchText && { search: debouncedSearchText }),
        ...(deptFilter && { category: deptFilter }),
        ...(caseTypeFilter && { title: caseTypeFilter }),
      } as Record<string, string>);

      const response = await apiClient.get(`/optimized/cases?${params}`, {
        signal: abortControllerRef.current.signal
      });

      const data: PaginatedResponse = response.data;
      
      if (append) {
        setCases(prev => [...prev, ...data.data]);
      } else {
        setCases(data.data);
        cache.set(cacheKey, data);
      }
      
      setTotal(data.pagination.total);
      setPerformanceMetrics(data.performance);
      setCurrentPage(page);
      setLastRefresh(new Date());
      setError(null);
      
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error('Failed to fetch cases:', error);
      setError('Error al cargar los casos. Intente nuevamente.');
      message.error('No se pudieron cargar los casos.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      abortControllerRef.current = null;
    }
  }, [pageSize, debouncedSearchText, deptFilter, caseTypeFilter, cache, generateCacheKey]);

  // Load initial data
  useEffect(() => {
    fetchCases(1);
  }, [fetchCases]);

  // Handle search changes
  useEffect(() => {
    debouncedSearch(searchText);
  }, [searchText, debouncedSearch]);

  // Handle filter changes
  useEffect(() => {
    setCurrentPage(1);
    fetchCases(1);
  }, [deptFilter, caseTypeFilter]);

  // Load more data (infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && currentPage * pageSize < total) {
      fetchCases(currentPage + 1, true);
    }
  }, [loadingMore, currentPage, pageSize, total, fetchCases]);

  // Refresh data
  const handleRefresh = useCallback(() => {
    cache.clear();
    fetchCases(1);
  }, [cache, fetchCases]);

  // Optimized table columns with memoization
  const columns = useMemo(() => [
    { 
      title: 'Título del Caso', 
      dataIndex: 'title', 
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      )
    },
    { 
      title: 'Departamento', 
      dataIndex: 'category', 
      key: 'category',
      width: 120,
    },
    {
      title: 'Número de Expediente',
      dataIndex: 'docketNumber',
      key: 'docketNumber',
      width: 150,
      render: (docketNumber: string) => docketNumber || '-',
    },
    {
      title: 'Juzgado',
      dataIndex: 'court',
      key: 'court',
      width: 150,
      render: (court: string) => court || '-',
    },
    {
      title: 'Cliente',
      dataIndex: ['client', 'firstName'],
      key: 'client',
      width: 150,
      render: (_: any, record: Case) => {
        const first = record.client?.firstName || '';
        const last = record.client?.lastName || '';
        const full = `${first} ${last}`.trim();
        return full || 'N/A';
      },
    },
    {
      title: 'Oficina',
      dataIndex: ['office', 'name'],
      key: 'office',
      width: 120,
      render: (_: any, record: Case) => record.office?.name || 'N/A',
    },
    {
      title: 'Fase del Caso',
      dataIndex: 'currentStage',
      key: 'currentStage',
      width: 150,
      render: (currentStage: string, record: Case) => {
        const stageLabels = getStageLabels(record.category);
        const stageLabel = stageLabels[currentStage] || currentStage;
        
        let color = 'default';
        if (record.category === 'Familiar' || record.category === 'Civil') {
          switch (currentStage) {
            case 'etapa_inicial': color = 'blue'; break;
            case 'notificacion': color = 'cyan'; break;
            case 'audiencia_preliminar': color = 'orange'; break;
            case 'audiencia_juicio': color = 'purple'; break;
            case 'sentencia': color = 'green'; break;
            default: color = 'default';
          }
        } else {
          switch (currentStage) {
            case 'intake': color = 'blue'; break;
            case 'initial_consultation': color = 'cyan'; break;
            case 'document_review': color = 'orange'; break;
            case 'action_plan': color = 'purple'; break;
            case 'resolution': color = 'green'; break;
            case 'closed': color = 'red'; break;
            default: color = 'default';
          }
        }
        
        return <Tag color={color}>{stageLabel}</Tag>;
      },
    },
    {
      title: 'Fecha de Creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: Case, b: Case) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: Case) => (
        <Link href={`/app/cases/${record.id}`}>
          <Button icon={<EyeOutlined />} size="small">Ver</Button>
        </Link>
      ),
    },
  ], []);

  // Performance statistics
  const performanceStats = useMemo(() => {
    if (!performanceMetrics) return null;
    
    return {
      queryTime: performanceMetrics.queryTime,
      cacheHit: performanceMetrics.cacheHit,
      responseSize: performanceMetrics.responseSize,
      cacheEfficiency: cache.getStats()
    };
  }, [performanceMetrics, cache]);

  const DEPARTMENTS = ['Familiar', 'Civil', 'Psicologia', 'Recursos'];
  const CASE_TYPES = [
    'Divorcios','Guardia y Custodia','Acto Prejudicial','Adopcion','Pension Alimenticia','Rectificacion de Actas','Reclamacion de Paternidad',
    'Prescripcion Positiva','Reinvindicatorio','Intestado',
    'Individual','Pareja',
    'Tutoria Escolar','Asistencia Social'
  ];

  return (
    <div>
      {/* Performance Header */}
      {performanceStats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={6}>
              <Statistic 
                title="Tiempo de Consulta" 
                value={performanceStats.queryTime} 
                suffix="ms"
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="Cache Hit" 
                value={performanceStats.cacheHit ? 'Sí' : 'No'}
                valueStyle={{ color: performanceStats.cacheHit ? '#52c41a' : '#ff4d4f' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="Tamaño Respuesta" 
                value={performanceStats.responseSize} 
                suffix="bytes"
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="Entradas en Cache" 
                value={performanceStats.cacheEfficiency.size}
                prefix={<BarChartOutlined />}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          message="Error de Carga"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={handleRefresh}>
              Reintentar
            </Button>
          }
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Casos</h1>
          <p className="text-gray-500 text-sm">
            Total: {total} casos • Última actualización: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            Actualizar
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            Crear Caso
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="Buscar casos..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              allowClear
              placeholder="Filtrar por Departamento"
              value={deptFilter}
              onChange={setDeptFilter}
              options={DEPARTMENTS.map(d => ({ label: d, value: d }))}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <Select
              allowClear
              showSearch
              placeholder="Filtrar por Tipo de Caso"
              value={caseTypeFilter}
              onChange={setCaseTypeFilter}
              options={CASE_TYPES.map(ct => ({ label: ct, value: ct }))}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              value={pageSize}
              onChange={setPageSize}
              options={[
                { label: '20 por página', value: 20 },
                { label: '50 por página', value: 50 },
                { label: '100 por página', value: 100 },
              ]}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={cases}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} de ${total} casos`,
            onChange: (page) => fetchCases(page),
          }}
          scroll={{ x: 1200 }}
          locale={{ 
            emptyText: loading ? 'Cargando casos...' : 'No hay casos para mostrar. ¡Crea el primero!' 
          }}
          size="small"
        />
      </Card>

      {/* Create Case Modal */}
      <CreateCaseModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={() => {
          setIsModalVisible(false);
          handleRefresh();
        }}
      />
    </div>
  );
};

export default CaseManagementPage;




