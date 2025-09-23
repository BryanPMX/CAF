'use client';

import { useState, useCallback, useEffect } from 'react';
import { Form, Input, Button, Card, message, Alert, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined, HeartOutlined, TeamOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiClient } from '@/app/lib/api';
import { LoginFormData, UserRole } from '@/app/lib/types';
import { handleApiError, logApiSuccess } from '@/app/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import ClientOnly from '@/components/ClientOnly';
import { logVersionInfo, isCorrectDomain } from '@/app/lib/version';

const { Title, Text, Paragraph } = Typography;

// Role-based redirect configuration
const ROLE_REDIRECTS: Record<UserRole, string> = {
  admin: '/admin',
  office_manager: '/admin',
  lawyer: '/',
  psychologist: '/',
  receptionist: '/',
  event_coordinator: '/',
  client: '/',
} as const;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { login, error: authError, clearError } = useAuth();

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true);
    logVersionInfo();
    
    // Check if we're on the correct domain
    if (!isCorrectDomain()) {
      console.warn('⚠️ Login page loaded on unexpected domain:', window.location.hostname);
    }
  }, []);

  const handleLogin = useCallback(async (values: LoginFormData) => {
    setLoading(true);
    clearError();
    
    try {
      const response = await apiClient.post('/login', values);
      
      if (response.data.token) {
        // Use the auth hook to handle login
        login(response.data.token, response.data.user);
        
        logApiSuccess('User logged in successfully', 'LoginPage', { email: values.email });
        message.success('¡Bienvenido al Sistema CAF!');
        
        // Role-based redirect logic
        const userRole = response.data.user?.role as UserRole;
        const redirectPath = ROLE_REDIRECTS[userRole] || '/';
        
        // Wait a moment to ensure everything is updated before redirect
        setTimeout(() => {
          router.push(redirectPath);
        }, 100);
      } else {
        message.error('Respuesta inválida del servidor');
      }
    } catch (error) {
      const errorMessage = handleApiError(error, 'LoginPage');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [login, router, clearError]);

  // Show loading state until component is mounted
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ClientOnly fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </div>
    }>
      <div className="min-h-screen flex">
        {/* Left Panel - Branding and Mission */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full"></div>
            <div className="absolute top-40 right-20 w-24 h-24 bg-white rounded-full"></div>
            <div className="absolute bottom-20 left-40 w-20 h-20 bg-white rounded-full"></div>
            <div className="absolute bottom-40 right-40 w-28 h-28 bg-white rounded-full"></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center items-center text-center text-white p-12">
            <div className="mb-8">
              <Image 
                src="/logo.png" 
                alt="CAF Logo" 
                width={120} 
                height={120}
                className="mx-auto mb-6"
                onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                priority
              />
              <h1 className="text-white text-4xl font-bold mb-4">
                Sistema CAF
              </h1>
              <Text className="text-blue-100 text-lg">
                Centro de Apoyo Familiar
              </Text>
            </div>
            
            <div className="max-w-md">
              <div className="flex items-center justify-center mb-6">
                <HeartOutlined className="text-4xl text-blue-200 mr-3" />
                <TeamOutlined className="text-4xl text-blue-200" />
              </div>
              
              <h2 className="text-white text-2xl mb-4">
                Fortaleciendo Familias, Construyendo Comunidad
              </h2>
              
              <Paragraph className="text-blue-100 text-lg leading-relaxed">
                Nuestro sistema integral de gestión facilita el apoyo y seguimiento 
                de casos familiares, promoviendo el bienestar y la unidad comunitaria.
              </Paragraph>
              
              <div className="mt-8 p-4 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm">
                <Text className="text-blue-100 text-sm">
                  "Juntos construimos un futuro mejor para nuestras familias"
                </Text>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 p-8">
          <div className="w-full max-w-md">
            <Card 
              className="shadow-2xl border-0 rounded-2xl"
              bodyStyle={{ padding: '40px' }}
            >
              <div className="text-center mb-8">
                {/* Mobile logo - always render to prevent hydration mismatch */}
                <div className="lg:hidden mb-6">
                  <Image 
                    src="/logo.png" 
                    alt="CAF Logo" 
                    width={80} 
                    height={80}
                    className="mx-auto"
                    onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <h2 className="text-gray-800 mb-2 text-2xl font-semibold">
                  Bienvenido de vuelta
                </h2>
                <Text className="text-gray-600 text-lg">
                  Inicia sesión en tu cuenta
                </Text>
              </div>
              
              {authError && (
                <Alert
                  message="Error de Autenticación"
                  description={authError}
                  type="error"
                  showIcon
                  className="mb-6"
                  closable
                  onClose={clearError}
                />
              )}
              
              <Form
                name="login"
                onFinish={handleLogin}
                autoComplete="off"
                layout="vertical"
                size="large"
              >
                <Form.Item
                  name="email"
                  label={<span className="text-gray-700 font-medium">Correo Electrónico</span>}
                  rules={[
                    { required: true, message: 'Por favor ingrese su correo electrónico' },
                    { type: 'email', message: 'Por favor ingrese un correo electrónico válido' }
                  ]}
                >
                  <Input 
                    prefix={<UserOutlined className="text-blue-500" />} 
                    placeholder="su@email.com"
                    className="h-12 rounded-lg border-gray-300 focus:border-blue-500 focus:shadow-lg transition-all duration-200"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label={<span className="text-gray-700 font-medium">Contraseña</span>}
                  rules={[
                    { required: true, message: 'Por favor ingrese su contraseña' }
                  ]}
                >
                  <Input.Password 
                    prefix={<LockOutlined className="text-blue-500" />} 
                    placeholder="••••••••"
                    className="h-12 rounded-lg border-gray-300 focus:border-blue-500 focus:shadow-lg transition-all duration-200"
                  />
                </Form.Item>

                <Form.Item className="mb-0">
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    className="w-full h-12 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                    style={{ 
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      border: 'none',
                      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                    }}
                  >
                    {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                  </Button>
                </Form.Item>
              </Form>
              
              <div className="mt-6 text-center">
                <Text className="text-gray-500 text-sm">
                  ¿Necesitas ayuda? Contacta al administrador del sistema
                </Text>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}