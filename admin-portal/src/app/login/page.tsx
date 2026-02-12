// admin-portal/src/app/login/page.tsx
// Refined login page with polished lighting, depth, and improved branding.
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
      <div className="login-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="login-page">
        <div className="login-aura login-aura-left" />
        <div className="login-aura login-aura-right" />

        <aside className="login-brand-panel">
          <div className="login-brand-pattern" />
          <div className="login-brand-glow login-brand-glow-one" />
          <div className="login-brand-glow login-brand-glow-two" />

          <div className="login-brand-inner">
            <div className="login-brand-logo-shell">
              <div className="login-brand-logo-frame">
                <Image
                  src="/logo.png"
                  alt="CAF Logo"
                  width={90}
                  height={90}
                  className="login-brand-logo"
                  onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                  priority
                />
              </div>
            </div>

            <span className="login-brand-eyebrow">Portal Institucional CAF</span>
            <h1 className="login-brand-title">Centro de Apoyo para la Familia A.C.</h1>
            <p className="login-brand-subtitle">
              Brindamos apoyo legal, psicológico y social a familias que lo necesitan.
            </p>

            <ul className="login-brand-highlights">
              <li>Asesoría legal y social confiable</li>
              <li>Seguimiento profesional y seguro</li>
              <li>Atención con enfoque humano</li>
            </ul>
          </div>
        </aside>

        <section className="login-form-panel">
          <div className="login-form-shell">
            <div className="login-mobile-brand">
              <span className="login-mobile-logo-shell">
                <Image
                  src="/logo.png"
                  alt="CAF Logo"
                  width={58}
                  height={58}
                  className="login-mobile-logo"
                  onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                  priority
                />
              </span>
              <span className="login-mobile-text">Centro de Apoyo para la Familia</span>
            </div>

            <div className="login-form-header">
              <Title level={3} className="login-form-title">
                Iniciar Sesión
              </Title>
              <Text className="login-form-subtitle">
                Acceda a su cuenta para continuar
              </Text>
            </div>

            {authError && (
              <Alert
                message="Error de Autenticación"
                description={authError}
                type="error"
                showIcon
                className="login-auth-alert"
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
                label={<span className="login-label">Correo Electrónico</span>}
                rules={[
                  { required: true, message: 'Ingrese su correo electrónico' },
                  { type: 'email', message: 'Ingrese un correo válido' }
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#90a1b8' }} />}
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span className="login-label">Contraseña</span>}
                rules={[
                  { required: true, message: 'Ingrese su contraseña' },
                  { min: 6, message: 'Mínimo 6 caracteres' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#90a1b8' }} />}
                  autoComplete="current-password"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="login-submit-btn"
                >
                  {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
                </Button>
              </Form.Item>
            </Form>

            <div className="login-form-footer">
              <Text className="login-form-footer-text">
                Centro de Apoyo para la Familia A.C.
              </Text>
            </div>
          </div>
        </section>

        <style jsx global>{`
          .login-loading {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            background: linear-gradient(140deg, #f3f8ff 0%, #ebf3fb 46%, #e8f5f3 100%);
            font-family: 'Avenir Next', 'Segoe UI', sans-serif;
          }

          .login-page {
            position: relative;
            display: flex;
            min-height: 100vh;
            overflow: hidden;
            background: linear-gradient(140deg, #f4f9ff 0%, #eef4fb 52%, #e8f5f2 100%);
            font-family: 'Avenir Next', 'Segoe UI', sans-serif;
          }

          .login-aura {
            position: absolute;
            border-radius: 999px;
            filter: blur(64px);
            opacity: 0.32;
            pointer-events: none;
          }

          .login-aura-left {
            width: 340px;
            height: 340px;
            background: #6aa4e7;
            top: -110px;
            left: -120px;
          }

          .login-aura-right {
            width: 320px;
            height: 320px;
            background: #38c7b5;
            right: -120px;
            bottom: -120px;
          }

          .login-brand-panel {
            display: none;
            position: relative;
            width: 46%;
            min-width: 420px;
            overflow: hidden;
            background: linear-gradient(145deg, #0f3f74 0%, #12508f 48%, #0f8a7d 100%);
            border-right: 1px solid rgba(255, 255, 255, 0.22);
            box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.08);
          }

          .login-brand-pattern {
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.17) 1px, transparent 1px);
            background-size: 26px 26px;
            opacity: 0.4;
          }

          .login-brand-glow {
            position: absolute;
            border-radius: 999px;
            filter: blur(48px);
            opacity: 0.45;
          }

          .login-brand-glow-one {
            width: 220px;
            height: 220px;
            top: -60px;
            right: -50px;
            background: rgba(166, 239, 230, 0.75);
          }

          .login-brand-glow-two {
            width: 260px;
            height: 260px;
            bottom: -100px;
            left: -60px;
            background: rgba(89, 150, 222, 0.72);
          }

          .login-brand-inner {
            position: relative;
            z-index: 2;
            display: flex;
            height: 100%;
            flex-direction: column;
            justify-content: center;
            padding: 56px 58px;
            color: #ffffff;
          }

          .login-brand-logo-shell {
            margin-bottom: 26px;
            width: fit-content;
            padding: 2px;
            border-radius: 22px;
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(166, 243, 237, 0.86));
            box-shadow: 0 18px 36px rgba(7, 23, 43, 0.34);
          }

          .login-brand-logo-frame {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 96px;
            height: 96px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.95);
          }

          .login-brand-logo {
            border-radius: 14px;
            object-fit: contain;
            filter: saturate(1.1) contrast(1.04);
          }

          .login-brand-eyebrow {
            display: inline-flex;
            margin-bottom: 12px;
            width: fit-content;
            border: 1px solid rgba(255, 255, 255, 0.36);
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.9);
            background: rgba(255, 255, 255, 0.11);
            backdrop-filter: blur(8px);
          }

          .login-brand-title {
            margin: 0;
            max-width: 470px;
            font-size: 40px;
            line-height: 1.18;
            font-weight: 800;
            text-wrap: balance;
          }

          .login-brand-subtitle {
            margin: 14px 0 20px;
            max-width: 440px;
            font-size: 16px;
            line-height: 1.7;
            color: rgba(245, 250, 255, 0.88);
          }

          .login-brand-highlights {
            margin: 0;
            padding-left: 18px;
            display: grid;
            gap: 8px;
            font-size: 14px;
            color: rgba(243, 249, 255, 0.85);
          }

          .login-form-panel {
            position: relative;
            z-index: 1;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 26px;
          }

          .login-form-shell {
            width: 100%;
            max-width: 430px;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.76);
            border: 1px solid rgba(138, 160, 186, 0.26);
            backdrop-filter: blur(16px);
            box-shadow:
              0 28px 52px rgba(8, 26, 49, 0.18),
              inset 0 1px 0 rgba(255, 255, 255, 0.85);
            padding: 34px;
          }

          .login-mobile-brand {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
          }

          .login-mobile-logo-shell {
            display: inline-flex;
            border-radius: 18px;
            padding: 2px;
            background: linear-gradient(145deg, #1f5eb3 0%, #17b7a5 100%);
            box-shadow: 0 12px 26px rgba(15, 70, 126, 0.24);
          }

          .login-mobile-logo {
            border-radius: 16px;
            background: #ffffff;
            padding: 6px;
            object-fit: contain;
          }

          .login-mobile-text {
            font-size: 13px;
            font-weight: 600;
            color: #49617d;
            letter-spacing: 0.01em;
          }

          .login-form-header {
            text-align: center;
            margin-bottom: 26px;
          }

          .login-form-title.ant-typography {
            margin: 0;
            color: #0f2747;
            font-weight: 800;
            letter-spacing: -0.01em;
          }

          .login-form-subtitle.ant-typography {
            color: #59718d;
            font-size: 14px;
          }

          .login-auth-alert {
            margin-bottom: 16px;
            border-radius: 10px;
          }

          .login-label {
            font-weight: 600;
            color: #334b67;
            letter-spacing: 0.01em;
          }

          .login-form-shell .login-input,
          .login-form-shell .login-input.ant-input-affix-wrapper {
            border-radius: 12px !important;
            border-color: #c5d3e2 !important;
            background: rgba(255, 255, 255, 0.92) !important;
            min-height: 50px;
            transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
          }

          .login-form-shell .login-input.ant-input-affix-wrapper:hover,
          .login-form-shell .login-input:hover {
            border-color: #92add0 !important;
          }

          .login-form-shell .login-input.ant-input-affix-wrapper-focused,
          .login-form-shell .login-input:focus {
            border-color: #1f5eb3 !important;
            box-shadow: 0 0 0 4px rgba(31, 94, 179, 0.14) !important;
          }

          .login-submit-btn.ant-btn {
            min-height: 52px;
            border-radius: 12px;
            border: none !important;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.01em;
            background: linear-gradient(135deg, #1f5eb3 0%, #17b7a5 100%) !important;
            box-shadow: 0 12px 24px rgba(16, 76, 136, 0.3);
            transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
          }

          .login-submit-btn.ant-btn:hover,
          .login-submit-btn.ant-btn:focus {
            transform: translateY(-1px);
            box-shadow: 0 16px 28px rgba(13, 67, 121, 0.34);
            filter: brightness(1.03);
          }

          .login-form-footer {
            margin-top: 28px;
            padding-top: 18px;
            border-top: 1px solid rgba(184, 200, 218, 0.52);
            text-align: center;
          }

          .login-form-footer-text.ant-typography {
            font-size: 12px;
            color: #7a8da3;
            letter-spacing: 0.02em;
          }

          @media (max-width: 899px) {
            .login-form-panel {
              padding: 18px;
            }

            .login-form-shell {
              max-width: 440px;
              padding: 26px 22px;
              border-radius: 20px;
            }
          }

          @media (min-width: 900px) {
            .login-brand-panel {
              display: block;
            }

            .login-mobile-brand {
              display: none;
            }

            .login-form-panel {
              padding: 46px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .login-submit-btn.ant-btn,
            .login-form-shell .login-input,
            .login-form-shell .login-input.ant-input-affix-wrapper {
              transition: none !important;
            }
          }
        `}</style>
      </div>
    </ClientOnly>
  );
}
