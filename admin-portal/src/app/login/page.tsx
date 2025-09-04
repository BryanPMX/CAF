'use client';

import { useState, useCallback } from 'react';
import { Form, Input, Button, Card, message, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/app/lib/api';
import { LoginFormData, UserRole } from '@/app/lib/types';
import { handleApiError, logApiSuccess } from '@/app/lib/logger';
import { useAuth } from '@/hooks/useAuth';

// Role-based redirect configuration
const ROLE_REDIRECTS: Record<UserRole, string> = {
  admin: '/admin',
  office_manager: '/admin',
  staff: '/',
  counselor: '/',
  psychologist: '/',
  client: '/',
} as const;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, error: authError, clearError } = useAuth();

  const handleLogin = useCallback(async (values: LoginFormData) => {
    setLoading(true);
    clearError();
    
    try {
      const response = await apiClient.post('/login', values);
      
      if (response.data.token) {
        // Use the auth hook to handle login
        login(response.data.token, response.data.user);
        
        logApiSuccess('User logged in successfully', 'LoginPage', { email: values.email });
        message.success('Login successful!');
        
        // Role-based redirect logic
        const userRole = response.data.user?.role as UserRole;
        const redirectPath = ROLE_REDIRECTS[userRole] || '/';
        
        // Wait a moment to ensure everything is updated before redirect
        setTimeout(() => {
          router.push(redirectPath);
        }, 100);
      } else {
        message.error('Invalid response from server');
      }
    } catch (error) {
      const errorMessage = handleApiError(error, 'LoginPage');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [login, router, clearError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">CAF System</h1>
          <p className="text-gray-600">Iniciar Sesión</p>
        </div>
        
        {authError && (
          <Alert
            message="Authentication Error"
            description={authError}
            type="error"
            showIcon
            className="mb-4"
            closable
            onClose={clearError}
          />
        )}
        
        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Por favor ingrese su email' },
              { type: 'email', message: 'Por favor ingrese un email válido' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="su@email.com"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[
              { required: true, message: 'Por favor ingrese su contraseña' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              className="w-full"
              size="large"
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
            >
              Iniciar Sesión
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
