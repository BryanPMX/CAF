import React, { useState, useEffect } from 'react';
import { Input, Select, DatePicker, Button, Space, Card, Tag } from 'antd';
import { SearchOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface SearchFilters {
  searchText: string;
  status: string;
  staffId: string;
  dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  clientId: string;
}

interface SmartSearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  staffList: Array<{ id: number; firstName: string; lastName: string; role: string }>;
  clientList: Array<{ id: number; firstName: string; lastName: string; email: string }>;
  loading?: boolean;
}

const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  onSearch,
  onClear,
  staffList,
  clientList,
  loading = false
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    searchText: '',
    status: '',
    staffId: '',
    dateRange: null,
    clientId: ''
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleClear = () => {
    setFilters({
      searchText: '',
      status: '',
      staffId: '',
      dateRange: null,
      clientId: ''
    });
    onClear();
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.searchText) count++;
    if (filters.status) count++;
    if (filters.staffId) count++;
    if (filters.dateRange) count++;
    if (filters.clientId) count++;
    return count;
  };

  return (
    <Card className="mb-4" size="small">
      <div className="flex flex-col space-y-3">
        {/* Main Search Bar */}
        <div className="flex items-center space-x-2">
          <Input
            placeholder="🔍 Buscar por título, cliente, caso..."
            value={filters.searchText}
            onChange={(e) => updateFilter('searchText', e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            style={{ flex: 1 }}
            allowClear
          />
          <Button 
            type="primary" 
            icon={<SearchOutlined />} 
            onClick={handleSearch}
            loading={loading}
          >
            Buscar
          </Button>
          <Button 
            icon={<FilterOutlined />} 
            onClick={() => setShowAdvanced(!showAdvanced)}
            type={showAdvanced ? 'primary' : 'default'}
          >
            Filtros {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
          </Button>
          <Button 
            icon={<ClearOutlined />} 
            onClick={handleClear}
            disabled={getActiveFiltersCount() === 0}
          >
            Limpiar
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t">
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <Select
                placeholder="Todos los estados"
                value={filters.status}
                onChange={(value) => updateFilter('status', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="confirmed">✅ Confirmada</Option>
                <Option value="pending">⏳ Pendiente</Option>
                <Option value="completed">✅ Completada</Option>
                <Option value="cancelled">❌ Cancelada</Option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Personal</label>
              <Select
                placeholder="Todo el personal"
                value={filters.staffId}
                onChange={(value) => updateFilter('staffId', value)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              >
                {staffList.map(staff => (
                  <Option key={staff.id} value={staff.id.toString()}>
                    {staff.firstName} {staff.lastName} ({staff.role})
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cliente</label>
              <Select
                placeholder="Todos los clientes"
                value={filters.clientId}
                onChange={(value) => updateFilter('clientId', value)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              >
                {clientList.map(client => (
                  <Option key={client.id} value={client.id.toString()}>
                    {client.firstName} {client.lastName} ({client.email})
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Rango de Fechas</label>
              <RangePicker
                value={filters.dateRange}
                onChange={(dates) => updateFilter('dateRange', dates)}
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                placeholder={['Desde', 'Hasta']}
              />
            </div>
          </div>
        )}

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-sm text-gray-600 mr-2">Filtros rápidos:</span>
          <Button 
            size="small" 
            onClick={() => updateFilter('status', 'confirmed')}
            type={filters.status === 'confirmed' ? 'primary' : 'default'}
          >
            ✅ Confirmadas
          </Button>
          <Button 
            size="small" 
            onClick={() => updateFilter('status', 'pending')}
            type={filters.status === 'pending' ? 'primary' : 'default'}
          >
            ⏳ Pendientes
          </Button>
          <Button 
            size="small" 
            onClick={() => updateFilter('status', 'completed')}
            type={filters.status === 'completed' ? 'primary' : 'default'}
          >
            ✅ Completadas
          </Button>
          <Button 
            size="small" 
            onClick={() => updateFilter('dateRange', [dayjs().startOf('day'), dayjs().endOf('day')])}
            type={filters.dateRange && filters.dateRange[0]?.isSame(dayjs(), 'day') ? 'primary' : 'default'}
          >
            📅 Hoy
          </Button>
          <Button 
            size="small" 
            onClick={() => updateFilter('dateRange', [dayjs().startOf('week'), dayjs().endOf('week')])}
            type={filters.dateRange && filters.dateRange[0]?.isSame(dayjs().startOf('week'), 'day') ? 'primary' : 'default'}
          >
            📅 Esta Semana
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default SmartSearchBar; 