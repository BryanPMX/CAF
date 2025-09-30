'use client';

import { useState, useCallback, useEffect } from 'react';
import { Form, Input, Button, Card, message, Alert, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined, HeartOutlined, TeamOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiClient } from '@/app/lib/api';
import { LoginFormData, UserRole } from '@/app/lib/types';
import { handleApiError, logApiSuccess } from '@/app/lib/logger';
import { useAuth } from '@/context/AuthContext';
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
  const { login, error: authError, clearError, isAuthenticated } = useAuth();

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true);
    logVersionInfo();
    
    // Check if we're on the correct domain
    if (!isCorrectDomain()) {
      console.warn('⚠️ Login page loaded on unexpected domain:', window.location.hostname);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  // Centralized login orchestrator - delegates all state management to AuthContext
  const handleLogin = useCallback(async (values: LoginFormData) => {
    setLoading(true);
    clearError();
    
    try {
      // Step 1: Make the login API call
      const response = await apiClient.post('/login', values);
      
      if (response.data.token && response.data.user) {
        // Step 2: CRITICAL - Delegate state management to AuthContext
        // AuthContext.login() is the single authoritative method for setting auth state
        // It will atomically store token and user data in localStorage
        // and update the React state immediately
        login(response.data.user, response.data.token);
        
        // Step 3: Log success
        logApiSuccess('User logged in successfully', 'LoginPage', { email: values.email });
        
        // Step 4: Show the single, correct welcome message
        message.success('¡Bienvenido al Sistema CAF!');
        
        // Step 5: Determine redirect path based on user role
        const userRole = response.data.user?.role as UserRole;
        const redirectPath = ROLE_REDIRECTS[userRole] || '/';
        
        // Step 6: Redirect immediately after state is updated
        // No setTimeout, no delays, no race conditions
        router.push(redirectPath);
        
      } else {
        throw new Error('Invalid response from server');
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      handleApiError(error, 'LoginPage');
      
      // Show user-friendly error message
      if (error?.response?.status === 401) {
        message.error('Credenciales inválidas. Verifica tu email y contraseña.');
      } else if (error?.response?.status === 429) {
        message.error('Demasiados intentos. Espera un momento antes de intentar nuevamente.');
      } else {
        message.error('Error al iniciar sesión. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [login, clearError, router]);

  // Don't render if not mounted or already authenticated
  if (!mounted || isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image 
                src="/logo.png" 
                alt="CAF Logo" 
                width={80} 
                height={80}
                className="rounded-full shadow-lg"
                onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                priority
              />
            </div>
            <Title level={2} className="text-gray-800 mb-2">
              Sistema CAF
            </Title>
            <Text className="text-gray-600">
              Centro de Apoyo para la Familia
            </Text>
          </div>

          {/* Login Card */}
          <Card className="shadow-xl border-0 rounded-2xl">
            <div className="text-center mb-6">
              <Title level={3} className="text-gray-800 mb-2">
                Iniciar Sesión
              </Title>
              <Text className="text-gray-600">
                Accede a tu cuenta para continuar
              </Text>
            </div>

            {/* Error Alert */}
            {authError && (
              <Alert
                message="Error de Autenticación"
                description={authError}
                type="error"
                showIcon
                className="mb-4"
                closable
                onClose={clearError}
              />
            )}

            {/* Login Form */}
            <Form
              name="login"
              onFinish={handleLogin}
              layout="vertical"
              size="large"
              autoComplete="off"
            >
              <Form.Item
                name="email"
                label="Correo Electrónico"
                rules={[
                  { required: true, message: 'Por favor ingresa tu correo electrónico' },
                  { type: 'email', message: 'Por favor ingresa un correo válido' }
                ]}
              >
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Contraseña"
                rules={[
                  { required: true, message: 'Por favor ingresa tu contraseña' },
                  { min: 6, message: 'La contraseña debe tener al menos 6 caracteres' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-gray-400" />}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  className="w-full h-12 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                  }}
                >
                  {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
                </Button>
              </Form.Item>
            </Form>

            {/* Footer */}
            <div className="text-center mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center space-x-2 text-gray-500">
                <HeartOutlined className="text-red-400" />
                <Text className="text-sm">
                  Hecho con amor para las familias
                </Text>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-400 mt-2">
                <TeamOutlined />
                <Text className="text-xs">
                  Centro de Apoyo para la Familia
                </Text>
              </div>
            </div>
          </Card>

          {/* Version Info */}
          <div className="text-center mt-4">
            <Text className="text-xs text-gray-400">
              Versión 1.0.0 | Sistema de Gestión CAF
            </Text>
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}