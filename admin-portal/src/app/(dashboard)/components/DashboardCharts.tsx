'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, DatePicker, Button, Space, Typography, Spin } from 'antd';
import { BarChartOutlined, PieChartOutlined, LineChartOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { Column, Pie, Line, Area } from '@ant-design/plots';
import { apiClient } from '@/app/lib/api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

interface ChartData {
  casesTrend: Array<{ month: string; cases: number; completed: number }>;
  statusDistribution: Array<{ status: string; count: number; percentage: number }>;
  appointmentsTrend: Array<{ date: string; appointments: number; completed: number }>;
  staffPerformance: Array<{ staff: string; cases: number; efficiency: number }>;
}

const DashboardCharts: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [chartType, setChartType] = useState<'cases' | 'appointments' | 'staff'>('cases');

  useEffect(() => {
    fetchChartData();
  }, [dateRange]);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      
      // Mock data for demonstration - replace with actual API calls
      const mockData: ChartData = {
        casesTrend: [
          { month: 'Ene', cases: 45, completed: 38 },
          { month: 'Feb', cases: 52, completed: 48 },
          { month: 'Mar', cases: 48, completed: 42 },
          { month: 'Abr', cases: 61, completed: 55 },
          { month: 'May', cases: 55, completed: 50 },
          { month: 'Jun', cases: 67, completed: 60 }
        ],
        statusDistribution: [
          { status: 'Abierto', count: 45, percentage: 35 },
          { status: 'En Proceso', count: 32, percentage: 25 },
          { status: 'Completado', count: 38, percentage: 30 },
          { status: 'Cerrado', count: 13, percentage: 10 }
        ],
        appointmentsTrend: [
          { date: '2024-01-01', appointments: 12, completed: 11 },
          { date: '2024-01-02', appointments: 15, completed: 14 },
          { date: '2024-01-03', appointments: 18, completed: 16 },
          { date: '2024-01-04', appointments: 14, completed: 13 },
          { date: '2024-01-05', appointments: 20, completed: 18 },
          { date: '2024-01-06', appointments: 16, completed: 15 },
          { date: '2024-01-07', appointments: 22, completed: 20 }
        ],
        staffPerformance: [
          { staff: 'María García', cases: 15, efficiency: 92 },
          { staff: 'Juan Pérez', cases: 12, efficiency: 88 },
          { staff: 'Ana López', cases: 18, efficiency: 95 },
          { staff: 'Carlos Ruiz', cases: 10, efficiency: 85 },
          { staff: 'Laura Martín', cases: 14, efficiency: 90 }
        ]
      };

      setChartData(mockData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const casesTrendConfig = {
    data: chartData?.casesTrend || [],
    xField: 'month',
    yField: 'cases',
    seriesField: 'type',
    isGroup: true,
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
    color: ['#1890ff', '#52c41a'],
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      shared: true,
      showCrosshairs: true,
    },
  };

  const statusDistributionConfig = {
    data: chartData?.statusDistribution || [],
    angleField: 'count',
    colorField: 'status',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    color: ['#1890ff', '#52c41a', '#faad14', '#f5222d'],
    interactions: [
      {
        type: 'element-active',
      },
    ],
  };

  const appointmentsTrendConfig = {
    data: chartData?.appointmentsTrend || [],
    xField: 'date',
    yField: 'appointments',
    smooth: true,
    color: '#1890ff',
    areaStyle: {
      fill: 'l(270) 0:#ffffff 0.5:#7ec2f3 1:#1890ff',
    },
    tooltip: {
      formatter: (datum: any) => {
        return { name: 'Citas', value: datum.appointments };
      },
    },
  };

  const staffPerformanceConfig = {
    data: chartData?.staffPerformance || [],
    xField: 'staff',
    yField: 'efficiency',
    color: '#722ed1',
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
    tooltip: {
      formatter: (datum: any) => {
        return { name: 'Eficiencia', value: `${datum.efficiency}%` };
      },
    },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="Cargando gráficos..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Title level={4} className="!mb-1">
              Análisis y Tendencias
            </Title>
            <Text type="secondary">
              Visualiza el rendimiento y las tendencias del sistema
            </Text>
          </div>
          
          <Space wrap>
            <Select
              value={chartType}
              onChange={setChartType}
              style={{ width: 150 }}
            >
              <Option value="cases">Casos</Option>
              <Option value="appointments">Citas</Option>
              <Option value="users">Personal</Option>
            </Select>
            
            <RangePicker
              placeholder={['Fecha inicio', 'Fecha fin']}
              onChange={(dates) => {
                if (dates) {
                  setDateRange([
                    dates[0]?.format('YYYY-MM-DD') || '',
                    dates[1]?.format('YYYY-MM-DD') || ''
                  ]);
                } else {
                  setDateRange(null);
                }
              }}
            />
            
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchChartData}
            >
              Actualizar
            </Button>
            
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
            >
              Exportar
            </Button>
          </Space>
        </div>
      </Card>

      {/* Charts Grid */}
      <Row gutter={[24, 24]}>
        {/* Cases Trend Chart */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div className="flex items-center">
                <BarChartOutlined className="mr-2 text-blue-500" />
                Tendencias de Casos
              </div>
            }
            className="h-full"
          >
            <div className="h-80">
              <Column {...casesTrendConfig} />
            </div>
          </Card>
        </Col>

        {/* Status Distribution Chart */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div className="flex items-center">
                <PieChartOutlined className="mr-2 text-green-500" />
                Distribución por Estado
              </div>
            }
            className="h-full"
          >
            <div className="h-80">
              <Pie {...statusDistributionConfig} />
            </div>
          </Card>
        </Col>

        {/* Appointments Trend Chart */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div className="flex items-center">
                <LineChartOutlined className="mr-2 text-purple-500" />
                Tendencias de Citas
              </div>
            }
            className="h-full"
          >
            <div className="h-80">
              <Area {...appointmentsTrendConfig} />
            </div>
          </Card>
        </Col>

        {/* Staff Performance Chart */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div className="flex items-center">
                <BarChartOutlined className="mr-2 text-orange-500" />
                Rendimiento del Personal
              </div>
            }
            className="h-full"
          >
            <div className="h-80">
              <Column {...staffPerformanceConfig} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardCharts;
