// admin-portal/src/app/login/page.tsx
// Login page with CAF indigo/violet branding, mobile-responsive, and secure auth.
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Form, Input, Button, message, Alert, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiClient } from '@/app/lib/api';
import { LoginFormData, UserRole } from '@/app/lib/types';
import { handleApiError, logApiSuccess } from '@/app/lib/logger';
import { useAuth } from '@/context/AuthContext';
import ClientOnly from '@/components/ClientOnly';
import { logVersionInfo, isCorrectDomain } from '@/app/lib/version';

const { Title, Text } = Typography;

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

  useEffect(() => {
    setMounted(true);
    logVersionInfo();
    if (!isCorrectDomain()) {
      console.warn('Login page loaded on unexpected domain:', window.location.hostname);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleLogin = useCallback(async (values: LoginFormData) => {
    setLoading(true);
    clearError();

    try {
      const response = await apiClient.post('/login', values);

      if (response.data.token && response.data.user) {
        login(response.data.user, response.data.token);
        logApiSuccess('User logged in successfully', 'LoginPage', { email: values.email });
        message.success('Bienvenido al Sistema CAF');

        const userRole = response.data.user?.role as UserRole;
        const redirectPath = ROLE_REDIRECTS[userRole] || '/';
        router.push(redirectPath);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      handleApiError(error, 'LoginPage');

      if (error?.response?.status === 401) {
        message.error('Credenciales inválidas. Verifique su correo y contraseña.');
      } else if (error?.response?.status === 429) {
        message.error('Demasiados intentos. Espere un momento antes de intentar nuevamente.');
      } else {
        message.error('Error al iniciar sesión. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [login, clearError, router]);

  if (!mounted || isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="login-page">
        {/* Left decorative panel (hidden on mobile) */}
        <div className="login-brand-panel">
          <div className="login-brand-inner">
            <div className="login-brand-logo-wrap">
              <Image
                src="/logo.png"
                alt="CAF Logo"
                width={80}
                height={80}
                className="login-brand-logo"
                onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                priority
              />
            </div>
            <h1 className="login-brand-title">Centro de Apoyo<br/>para la Familia A.C.</h1>
            <p className="login-brand-subtitle">
              Brindamos apoyo legal, psicológico y social a familias que lo necesitan.
            </p>
          </div>
          <div className="login-brand-dots" />
        </div>

        {/* Right login form */}
        <div className="login-form-panel">
          <div className="login-form-container">
            {/* Mobile-only logo */}
            <div className="login-mobile-logo">
              <Image
                src="/logo.png"
                alt="CAF Logo"
                width={56}
                height={56}
                onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                priority
              />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>
                Iniciar Sesión
              </Title>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                Acceda a su cuenta para continuar
              </Text>
            </div>

            {authError && (
              <Alert
                message="Error de Autenticación"
                description={authError}
                type="error"
                showIcon
                style={{ marginBottom: 16, borderRadius: 8 }}
                closable
                onClose={clearError}
              />
            )}

            <Form
              name="login"
              onFinish={handleLogin}
              layout="vertical"
              size="large"
              autoComplete="off"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                label={<span style={{ fontWeight: 500, color: '#374151' }}>Correo Electrónico</span>}
                rules={[
                  { required: true, message: 'Ingrese su correo electr\u00F3nico' },
                  { type: 'email', message: 'Ingrese un correo v\u00E1lido' }
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  style={{ borderRadius: 10, height: 48 }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span style={{ fontWeight: 500, color: '#374151' }}>Contraseña</span>}
                rules={[
                  { required: true, message: 'Ingrese su contrase\u00F1a' },
                  { min: 6, message: 'M\u00EDnimo 6 caracteres' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="Su contrase\u00F1a"
                  autoComplete="current-password"
                  style={{ borderRadius: 10, height: 48 }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{
                    height: 50,
                    fontSize: 16,
                    fontWeight: 600,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                  }}
                >
                  {loading ? 'Iniciando Sesi\u00F3n...' : 'Iniciar Sesi\u00F3n'}
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                Centro de Apoyo para la Familia A.C.
              </Text>
            </div>
          </div>
        </div>

        <style jsx global>{`
          .login-page {
            display: flex;
            min-height: 100vh;
            background: #f8fafc;
          }

          .login-brand-panel {
            display: none;
            position: relative;
            width: 45%;
            background: linear-gradient(135deg, #4f46e5 0%, #6d28d9 50%, #7c3aed 100%);
            overflow: hidden;
          }

          .login-brand-inner {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 48px;
            text-align: center;
          }

          .login-brand-logo-wrap {
            width: 88px;
            height: 88px;
            border-radius: 20px;
            background: rgba(255,255,255,0.15);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          }

          .login-brand-logo {
            border-radius: 12px;
          }

          .login-brand-title {
            font-size: 28px;
            font-weight: 800;
            color: white;
            line-height: 1.3;
            margin-bottom: 12px;
          }

          .login-brand-subtitle {
            font-size: 15px;
            color: rgba(255,255,255,0.75);
            max-width: 320px;
            line-height: 1.6;
          }

          .login-brand-dots {
            position: absolute;
            inset: 0;
            z-index: 1;
            background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
            background-size: 24px 24px;
          }

          .login-form-panel {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }

          .login-form-container {
            width: 100%;
            max-width: 400px;
          }

          .login-mobile-logo {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
          }

          @media (min-width: 768px) {
            .login-brand-panel {
              display: block;
            }
            .login-mobile-logo {
              display: none;
            }
            .login-form-panel {
              padding: 48px;
            }
          }
        `}</style>
      </div>
    </ClientOnly>
  );
}
