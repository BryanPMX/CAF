'use client';

import React, { useState, useEffect } from 'react';
import { Input, Select, DatePicker, Space, Card } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { SearchFilters, SelectOption } from '@/app/lib/types';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface SmartSearchBarProps {
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  showFilters?: boolean;
  appointmentStatuses?: Array<{ value: string; label: string }>;
  appointmentDepartments?: string[];
  caseCategories?: string[];
}

const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  onFiltersChange,
  onSearch,
  placeholder = "Buscar casos, citas, usuarios...",
  showFilters = true,
  appointmentStatuses,
  appointmentDepartments,
  caseCategories
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  // Filter options - use provided props or defaults
  const statusOptions: SelectOption[] = appointmentStatuses ? appointmentStatuses.map(s => ({ value: s.value, label: s.label })) : [
    { value: 'open', label: 'Abierto' },
    { value: 'closed', label: 'Cerrado' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'in_progress', label: 'En Progreso' }
  ];

  const categoryOptions: SelectOption[] = caseCategories ? caseCategories.map(c => ({ value: c, label: c })) : [
    { value: 'legal', label: 'Legal' },
    { value: 'psychological', label: 'Psicológico' },
    { value: 'social', label: 'Social' },
    { value: 'medical', label: 'Médico' }
  ];

  const departmentOptions: SelectOption[] = appointmentDepartments ? appointmentDepartments.map(d => ({ value: d, label: d })) : [
    { value: 'legal', label: 'Departamento Legal' },
    { value: 'psychology', label: 'Departamento de Psicología' },
    { value: 'social_work', label: 'Trabajo Social' },
    { value: 'medical', label: 'Departamento Médico' }
  ];

  const updateFilter = (key: keyof SearchFilters, value: string | [string, string] | undefined) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const clearFilters = () => {
    const clearedFilters: SearchFilters = {};
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const toggleFilters = () => {
    setIsFiltersVisible(!isFiltersVisible);
  };

  return (
    <Card className="mb-4">
      <Space direction="vertical" size="middle" className="w-full">
        {/* Search Input */}
        <div className="flex items-center space-x-2">
          <Input
            placeholder={placeholder}
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1"
            size="large"
          />
          {showFilters && (
            <button
              onClick={toggleFilters}
              className={`px-3 py-2 rounded border transition-colors ${
                isFiltersVisible 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-500'
              }`}
            >
              <FilterOutlined />
            </button>
          )}
        </div>

        {/* Filters Section */}
        {showFilters && isFiltersVisible && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <Select
                  placeholder="Todos los estados"
                  value={filters.status}
                  onChange={(value) => updateFilter('status', value)}
                  allowClear
                  className="w-full"
                >
                  {statusOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <Select
                  placeholder="Todas las categorías"
                  value={filters.category}
                  onChange={(value) => updateFilter('category', value)}
                  allowClear
                  className="w-full"
                >
                  {categoryOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento
                </label>
                <Select
                  placeholder="Todos los departamentos"
                  value={filters.department}
                  onChange={(value) => updateFilter('department', value)}
                  allowClear
                  className="w-full"
                >
                  {departmentOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rango de Fechas
                </label>
                <RangePicker
                  className="w-full"
                  onChange={(dates) => {
                    if (dates) {
                      const [start, end] = dates;
                      updateFilter('dateRange', [
                        start?.toISOString() || '',
                        end?.toISOString() || ''
                      ]);
                    } else {
                      updateFilter('dateRange', undefined);
                    }
                  }}
                />
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default SmartSearchBar; 