'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Switch, 
  Select, 
  Button, 
  Space, 
  Typography, 
  Divider, 
  Row, 
  Col, 
  Tooltip,
  Modal,
  Form,
  Input,
  ColorPicker,
  message,
  Badge,
  Tag
} from 'antd';
import { 
  SettingOutlined, 
  EyeOutlined, 
  SaveOutlined, 
  ReloadOutlined,
  BgColorsOutlined,
  LayoutOutlined,
  BellOutlined,
  BarChartOutlined,
  UserOutlined,
  LockOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

interface DashboardPreferences {
  theme: 'light' | 'dark' | 'auto';
  layout: 'compact' | 'comfortable' | 'spacious';
  showCharts: boolean;
  showNotifications: boolean;
  showQuickActions: boolean;
  showSystemStatus: boolean;
  refreshInterval: number;
  primaryColor: string;
  cardStyle: 'default' | 'minimal' | 'elevated';
  animations: boolean;
}

const DashboardCustomization: React.FC = () => {
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    theme: 'light',
    layout: 'comfortable',
    showCharts: true,
    showNotifications: true,
    showQuickActions: true,
    showSystemStatus: true,
    refreshInterval: 30,
    primaryColor: '#1890ff',
    cardStyle: 'default',
    animations: true
  });
  
  const [loading, setLoading] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const saved = localStorage.getItem('dashboardPreferences');
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const savePreferences = async () => {
    try {
      setLoading(true);
      localStorage.setItem('dashboardPreferences', JSON.stringify(preferences));
      
      // Apply theme changes immediately
      applyTheme(preferences.theme);
      
      message.success('Preferencias guardadas correctamente');
    } catch (error) {
      message.error('Error al guardar las preferencias');
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const resetToDefaults = () => {
    const defaults: DashboardPreferences = {
      theme: 'light',
      layout: 'comfortable',
      showCharts: true,
      showNotifications: true,
      showQuickActions: true,
      showSystemStatus: true,
      refreshInterval: 30,
      primaryColor: '#1890ff',
      cardStyle: 'default',
      animations: true
    };
    setPreferences(defaults);
    applyTheme(defaults.theme);
  };

  const updatePreference = (key: keyof DashboardPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card 
      title={
        <div className="flex items-center">
          <SettingOutlined className="mr-2 text-blue-500" />
          <span className="text-sm sm:text-base">Personalización del Dashboard</span>
        </div>
      }
      className="h-full"
      extra={
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={resetToDefaults}
            size="small"
          >
            Restaurar
          </Button>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={savePreferences}
            loading={loading}
            size="small"
          >
            Guardar
          </Button>
        </Space>
      }
    >
      <div className="space-y-4">
        {/* Theme Settings */}
        <div>
          <Title level={5} className="!mb-3 flex items-center">
            <BgColorsOutlined className="mr-2 text-purple-500" />
            Apariencia
          </Title>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Text strong>Tema</Text>
                <br />
                <Text type="secondary" className="text-xs">
                  Selecciona el tema visual del dashboard
                </Text>
              </div>
              <Select
                value={preferences.theme}
                onChange={(value) => updatePreference('theme', value)}
                style={{ width: 120 }}
                size="small"
              >
                <Option value="light">Claro</Option>
                <Option value="dark">Oscuro</Option>
                <Option value="auto">Automático</Option>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Text strong>Color Principal</Text>
                <br />
                <Text type="secondary" className="text-xs">
                  Personaliza el color principal
                </Text>
              </div>
              <Button
                size="small"
                onClick={() => setColorModalVisible(true)}
                style={{ backgroundColor: preferences.primaryColor, borderColor: preferences.primaryColor }}
              >
                <div 
                  className="w-4 h-4 rounded-full border border-white"
                  style={{ backgroundColor: preferences.primaryColor }}
                />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Text strong>Estilo de Tarjetas</Text>
                <br />
                <Text type="secondary" className="text-xs">
                  Apariencia de las tarjetas
                </Text>
              </div>
              <Select
                value={preferences.cardStyle}
                onChange={(value) => updatePreference('cardStyle', value)}
                style={{ width: 120 }}
                size="small"
              >
                <Option value="default">Por Defecto</Option>
                <Option value="minimal">Minimalista</Option>
                <Option value="elevated">Elevado</Option>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Text strong>Animaciones</Text>
                <br />
                <Text type="secondary" className="text-xs">
                  Habilitar transiciones suaves
                </Text>
              </div>
              <Switch
                checked={preferences.animations}
                onChange={(checked) => updatePreference('animations', checked)}
                size="small"
              />
            </div>
          </div>
        </div>

        <Divider className="!my-4" />

        {/* Layout Settings */}
        <div>
          <Title level={5} className="!mb-3 flex items-center">
            <LayoutOutlined className="mr-2 text-green-500" />
            Diseño
          </Title>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Text strong>Densidad del Layout</Text>
                <br />
                <Text type="secondary" className="text-xs">
                  Espaciado entre elementos
                </Text>
              </div>
              <Select
                value={preferences.layout}
                onChange={(value) => updatePreference('layout', value)}
                style={{ width: 120 }}
                size="small"
              >
                <Option value="compact">Compacto</Option>
                <Option value="comfortable">Cómodo</Option>
                <Option value="spacious">Espacioso</Option>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Text strong>Intervalo de Actualización</Text>
                <br />
                <Text type="secondary" className="text-xs">
                  Frecuencia de actualización automática
                </Text>
              </div>
              <Select
                value={preferences.refreshInterval}
                onChange={(value) => updatePreference('refreshInterval', value)}
                style={{ width: 120 }}
                size="small"
              >
                <Option value={15}>15 seg</Option>
                <Option value={30}>30 seg</Option>
                <Option value={60}>1 min</Option>
                <Option value={300}>5 min</Option>
              </Select>
            </div>
          </div>
        </div>

        <Divider className="!my-4" />

        {/* Component Visibility */}
        <div>
          <Title level={5} className="!mb-3 flex items-center">
            <EyeOutlined className="mr-2 text-orange-500" />
            Visibilidad de Componentes
          </Title>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BarChartOutlined className="mr-2 text-blue-500" />
                <div>
                  <Text strong>Gráficos y Análisis</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Mostrar sección de gráficos
                  </Text>
                </div>
              </div>
              <Switch
                checked={preferences.showCharts}
                onChange={(checked) => updatePreference('showCharts', checked)}
                size="small"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BellOutlined className="mr-2 text-red-500" />
                <div>
                  <Text strong>Notificaciones</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Mostrar notificaciones en tiempo real
                  </Text>
                </div>
              </div>
              <Switch
                checked={preferences.showNotifications}
                onChange={(checked) => updatePreference('showNotifications', checked)}
                size="small"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UserOutlined className="mr-2 text-purple-500" />
                <div>
                  <Text strong>Acciones Rápidas</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Mostrar botones de acción rápida
                  </Text>
                </div>
              </div>
              <Switch
                checked={preferences.showQuickActions}
                onChange={(checked) => updatePreference('showQuickActions', checked)}
                size="small"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <LockOutlined className="mr-2 text-green-500" />
                <div>
                  <Text strong>Estado del Sistema</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Mostrar información del sistema
                  </Text>
                </div>
              </div>
              <Switch
                checked={preferences.showSystemStatus}
                onChange={(checked) => updatePreference('showSystemStatus', checked)}
                size="small"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Color Picker Modal */}
      <Modal
        title="Seleccionar Color Principal"
        open={colorModalVisible}
        onCancel={() => setColorModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setColorModalVisible(false)}>
            Cancelar
          </Button>,
          <Button 
            key="ok" 
            type="primary" 
            onClick={() => setColorModalVisible(false)}
          >
            Aplicar
          </Button>
        ]}
      >
        <div className="text-center py-4">
          <ColorPicker
            value={preferences.primaryColor}
            onChange={(color) => updatePreference('primaryColor', color.toHexString())}
            showText
          />
          <div className="mt-4">
            <Text type="secondary" className="text-sm">
              El color se aplicará a botones, enlaces y elementos destacados
            </Text>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default DashboardCustomization;
