// admin-portal/src/app/login/page.tsx
// Modernized login experience with a new layout, premium glass effects, and unified brand colors.
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Form, Input, Button, message, Alert, Typography, Spin } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
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

const SHOWCASE_POINTS = [
  'Expedientes, citas y tareas en un mismo panel operativo.',
  'Trazabilidad por roles para cada acción administrativa.',
  'Flujo visual optimizado para atención rápida y precisa.',
] as const;

const SHOWCASE_KPIS = [
  { value: '24/7', label: 'Monitoreo operativo' },
  { value: '100%', label: 'Sesiones cifradas' },
  { value: '1 panel', label: 'Gestión centralizada' },
] as const;

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
      <div className="login-scene">
        <div className="login-mesh" />
        <div className="login-orb login-orb-primary" />
        <div className="login-orb login-orb-purple" />
        <div className="login-orb login-orb-aqua" />

        <div className="login-main-shell">
          <aside className="login-showcase">
            <div className="login-showcase-pattern" />
            <div className="login-showcase-glow login-showcase-glow-top" />
            <div className="login-showcase-glow login-showcase-glow-bottom" />

            <div className="login-showcase-content">
              <div className="login-brand-row">
                <span className="login-brand-logo-frame">
                  <Image
                    src="/logo.png"
                    alt="CAF Logo"
                    width={84}
                    height={84}
                    className="login-brand-logo"
                    onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                    priority
                  />
                </span>
                <div className="login-brand-copy">
                  <span className="login-brand-eyebrow">Centro de Apoyo para la Familia</span>
                  <span className="login-brand-label">Plataforma Administrativa</span>
                </div>
              </div>

              <span className="login-security-chip">
                <SafetyCertificateOutlined />
                Acceso seguro y controlado
              </span>

              <h1 className="login-showcase-title">
                Un acceso moderno para la operación diaria del equipo CAF.
              </h1>

              <p className="login-showcase-subtitle">
                Diseñado para trabajar con claridad, rapidez y seguimiento profesional en
                cada área de servicio.
              </p>

              <ul className="login-showcase-points">
                {SHOWCASE_POINTS.map((point) => (
                  <li key={point}>
                    <span className="login-point-icon">
                      <CheckCircleFilled />
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="login-kpi-grid">
                {SHOWCASE_KPIS.map((kpi) => (
                  <div className="login-kpi-card" key={kpi.label}>
                    <span className="login-kpi-value">{kpi.value}</span>
                    <span className="login-kpi-label">{kpi.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="login-auth-panel">
            <div className="login-auth-card">
              <div className="login-auth-sheen" />

              <div className="login-mobile-brand">
                <span className="login-mobile-logo-frame">
                  <Image
                    src="/logo.png"
                    alt="CAF Logo"
                    width={56}
                    height={56}
                    className="login-mobile-logo"
                    onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                    priority
                  />
                </span>
                <span className="login-mobile-brand-text">Portal CAF</span>
              </div>

              <div className="login-form-header">
                <Title level={3} className="login-form-title">
                  Iniciar sesión
                </Title>
                <Text className="login-form-subtitle">
                  Ingresa tus credenciales para continuar al panel administrativo.
                </Text>
              </div>

              {authError && (
                <Alert
                  message="Error de autenticación"
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
                  label={<span className="login-label">Correo electrónico</span>}
                  rules={[
                    { required: true, message: 'Ingrese su correo electrónico' },
                    { type: 'email', message: 'Ingrese un correo válido' },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined style={{ color: '#89a0c4' }} />}
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
                    { min: 6, message: 'Mínimo 6 caracteres' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#89a0c4' }} />}
                    autoComplete="current-password"
                    className="login-input"
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, marginTop: 10 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    className="login-submit-btn"
                  >
                    {loading ? 'Iniciando sesión...' : 'Entrar al sistema'}
                  </Button>
                </Form.Item>
              </Form>

              <div className="login-form-footer">
                <Text className="login-form-footer-text">
                  Centro de Apoyo para la Familia A.C. • Plataforma institucional
                </Text>
              </div>
            </div>
          </section>
        </div>

        <style jsx global>{`
          .login-loading {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            background:
              radial-gradient(circle at 10% 8%, rgba(95, 140, 216, 0.24), transparent 42%),
              radial-gradient(circle at 90% 94%, rgba(157, 122, 255, 0.22), transparent 40%),
              linear-gradient(145deg, #ffffff 0%, #f8f4ff 48%, #eef5ff 100%);
          }

          .login-scene {
            --login-blue: #1f5eb3;
            --login-blue-deep: #17498d;
            --login-lilac: #9d7aff;
            --login-lilac-soft: #e8dcff;
            --login-aqua: #17b7a5;
            --login-ink: #102647;
            --login-ink-soft: #4d6384;

            position: relative;
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 24px;
            overflow: hidden;
            background:
              radial-gradient(circle at 8% 10%, rgba(81, 136, 227, 0.28), transparent 36%),
              radial-gradient(circle at 88% 8%, rgba(157, 122, 255, 0.26), transparent 34%),
              radial-gradient(circle at 82% 92%, rgba(23, 183, 165, 0.18), transparent 38%),
              linear-gradient(150deg, #ffffff 0%, #f7f2ff 46%, #eef5ff 100%);
          }

          .login-mesh {
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.56;
            background:
              linear-gradient(120deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.12) 48%, transparent 72%),
              radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.7) 0%, transparent 55%);
          }

          .login-orb {
            position: absolute;
            border-radius: 999px;
            pointer-events: none;
            filter: blur(74px);
            opacity: 0.52;
            animation: loginOrbFloat 10s ease-in-out infinite;
          }

          .login-orb-primary {
            width: 320px;
            height: 320px;
            top: -110px;
            left: -80px;
            background: rgba(55, 112, 214, 0.62);
          }

          .login-orb-purple {
            width: 340px;
            height: 340px;
            right: -120px;
            top: -90px;
            background: rgba(157, 122, 255, 0.6);
            animation-delay: -2.8s;
          }

          .login-orb-aqua {
            width: 280px;
            height: 280px;
            right: 6%;
            bottom: -120px;
            background: rgba(23, 183, 165, 0.46);
            animation-delay: -4.2s;
          }

          .login-main-shell {
            position: relative;
            z-index: 2;
            display: grid;
            width: min(1120px, 100%);
            grid-template-columns: minmax(320px, 1.05fr) minmax(360px, 0.95fr);
            border-radius: 30px;
            overflow: hidden;
            border: 1px solid rgba(186, 205, 236, 0.76);
            background: linear-gradient(140deg, rgba(255, 255, 255, 0.56), rgba(246, 251, 255, 0.38));
            backdrop-filter: blur(18px) saturate(130%);
            box-shadow:
              0 36px 72px rgba(15, 32, 62, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.72);
          }

          .login-main-shell::before {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: linear-gradient(118deg, rgba(255, 255, 255, 0.22) 0%, transparent 34%, rgba(255, 255, 255, 0.16) 65%, transparent 85%);
            opacity: 0.75;
          }

          .login-showcase {
            position: relative;
            overflow: hidden;
            min-height: 620px;
            background: linear-gradient(160deg, rgba(19, 57, 111, 0.94) 0%, rgba(38, 76, 147, 0.86) 43%, rgba(111, 89, 193, 0.82) 100%);
            color: #ffffff;
          }

          .login-showcase-pattern {
            position: absolute;
            inset: 0;
            opacity: 0.24;
            background-image:
              radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.22) 1px, transparent 1px),
              linear-gradient(125deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%);
            background-size: 28px 28px, 100% 100%;
          }

          .login-showcase-glow {
            position: absolute;
            border-radius: 999px;
            filter: blur(54px);
            opacity: 0.54;
            pointer-events: none;
          }

          .login-showcase-glow-top {
            width: 220px;
            height: 220px;
            top: -70px;
            right: -40px;
            background: rgba(154, 124, 255, 0.8);
          }

          .login-showcase-glow-bottom {
            width: 230px;
            height: 230px;
            left: -70px;
            bottom: -90px;
            background: rgba(34, 211, 238, 0.56);
          }

          .login-showcase-content {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            height: 100%;
            justify-content: center;
            gap: 18px;
            padding: 52px 48px;
          }

          .login-brand-row {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .login-brand-logo-frame {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 88px;
            height: 88px;
            border-radius: 22px;
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(236, 247, 255, 0.86));
            box-shadow:
              0 22px 34px rgba(5, 17, 34, 0.34),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
          }

          .login-brand-logo {
            width: 66px;
            height: 66px;
            object-fit: contain;
            border-radius: 14px;
            background: #ffffff;
          }

          .login-brand-copy {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .login-brand-eyebrow {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.82);
          }

          .login-brand-label {
            font-size: 15px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.94);
          }

          .login-security-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: fit-content;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.28);
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.94);
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(8px);
          }

          .login-showcase-title {
            margin: 0;
            max-width: 520px;
            font-size: clamp(1.9rem, 2.4vw, 2.55rem);
            line-height: 1.2;
            font-weight: 800;
            text-wrap: balance;
          }

          .login-showcase-subtitle {
            margin: 0;
            max-width: 500px;
            font-size: 15px;
            line-height: 1.72;
            color: rgba(236, 245, 255, 0.9);
          }

          .login-showcase-points {
            margin: 2px 0 0;
            padding: 0;
            list-style: none;
            display: grid;
            gap: 10px;
          }

          .login-showcase-points li {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            color: rgba(242, 248, 255, 0.92);
            font-size: 14px;
            line-height: 1.5;
          }

          .login-point-icon {
            margin-top: 2px;
            color: #b9ebff;
            font-size: 13px;
            filter: drop-shadow(0 2px 5px rgba(44, 183, 255, 0.36));
          }

          .login-kpi-grid {
            margin-top: 8px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          .login-kpi-card {
            display: flex;
            flex-direction: column;
            gap: 3px;
            padding: 12px 10px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.24);
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.08));
            backdrop-filter: blur(7px);
            transition: transform 0.24s ease, border-color 0.24s ease;
          }

          .login-kpi-card:hover {
            transform: translateY(-1px);
            border-color: rgba(255, 255, 255, 0.45);
          }

          .login-kpi-value {
            font-size: 1.04rem;
            font-weight: 800;
            color: #ffffff;
          }

          .login-kpi-label {
            font-size: 11px;
            letter-spacing: 0.03em;
            color: rgba(233, 245, 255, 0.86);
          }

          .login-auth-panel {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 34px;
            background: linear-gradient(165deg, rgba(255, 255, 255, 0.58), rgba(244, 240, 255, 0.38));
          }

          .login-auth-card {
            position: relative;
            width: 100%;
            max-width: 430px;
            border-radius: 24px;
            overflow: hidden;
            border: 1px solid rgba(180, 197, 229, 0.7);
            background: linear-gradient(155deg, rgba(255, 255, 255, 0.9) 0%, rgba(245, 250, 255, 0.84) 56%, rgba(241, 235, 255, 0.78) 100%);
            box-shadow:
              0 26px 48px rgba(10, 26, 52, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.86);
            backdrop-filter: blur(14px) saturate(126%);
            padding: 32px 30px;
            transition: transform 0.28s ease, box-shadow 0.28s ease;
          }

          .login-auth-card:hover {
            transform: translateY(-2px);
            box-shadow:
              0 32px 56px rgba(10, 26, 52, 0.24),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
          }

          .login-auth-sheen {
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: linear-gradient(120deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.14) 48%, transparent 72%);
            opacity: 0.6;
          }

          .login-mobile-brand {
            display: none;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 18px;
          }

          .login-mobile-logo-frame {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 60px;
            height: 60px;
            border-radius: 16px;
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(235, 247, 255, 0.84));
            border: 1px solid rgba(176, 198, 231, 0.64);
            box-shadow: 0 10px 22px rgba(13, 41, 79, 0.16);
          }

          .login-mobile-logo {
            width: 46px;
            height: 46px;
            object-fit: contain;
            border-radius: 10px;
          }

          .login-mobile-brand-text {
            font-size: 13px;
            font-weight: 600;
            color: #486188;
            letter-spacing: 0.02em;
          }

          .login-form-header {
            position: relative;
            text-align: center;
            margin-bottom: 22px;
          }

          .login-form-title.ant-typography {
            margin: 0;
            color: var(--login-ink);
            font-weight: 800;
            letter-spacing: -0.015em;
          }

          .login-form-subtitle.ant-typography {
            display: inline-block;
            max-width: 340px;
            margin-top: 6px;
            color: var(--login-ink-soft);
            font-size: 14px;
            line-height: 1.55;
          }

          .login-auth-alert {
            margin-bottom: 16px;
            border-radius: 12px;
            border: 1px solid rgba(206, 170, 211, 0.55);
            background: rgba(255, 245, 248, 0.76);
          }

          .login-label {
            font-weight: 600;
            color: #365178;
            letter-spacing: 0.01em;
          }

          .login-auth-card .login-input,
          .login-auth-card .login-input.ant-input-affix-wrapper {
            min-height: 50px;
            border-radius: 13px !important;
            border-color: rgba(158, 183, 219, 0.72) !important;
            background: rgba(255, 255, 255, 0.78) !important;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          }

          .login-auth-card .login-input.ant-input-affix-wrapper:hover,
          .login-auth-card .login-input:hover {
            border-color: rgba(91, 127, 199, 0.72) !important;
          }

          .login-auth-card .login-input.ant-input-affix-wrapper-focused,
          .login-auth-card .login-input:focus {
            border-color: var(--login-blue) !important;
            box-shadow: 0 0 0 4px rgba(60, 109, 198, 0.19) !important;
          }

          .login-submit-btn.ant-btn {
            min-height: 52px;
            border-radius: 13px;
            border: none !important;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.01em;
            background: linear-gradient(120deg, #1f5eb3 0%, #6f63cc 55%, #17b7a5 100%) !important;
            background-size: 180% 180% !important;
            box-shadow: 0 14px 26px rgba(21, 66, 126, 0.28);
            transition: transform 0.24s ease, box-shadow 0.24s ease, filter 0.24s ease;
            animation: loginButtonShift 6s ease infinite;
          }

          .login-submit-btn.ant-btn:hover,
          .login-submit-btn.ant-btn:focus {
            transform: translateY(-1px);
            filter: brightness(1.03);
            box-shadow: 0 18px 30px rgba(15, 54, 108, 0.34);
          }

          .login-form-footer {
            margin-top: 24px;
            border-top: 1px solid rgba(180, 196, 221, 0.6);
            padding-top: 16px;
            text-align: center;
          }

          .login-form-footer-text.ant-typography {
            font-size: 12px;
            color: #7085a2;
            letter-spacing: 0.02em;
          }

          @media (max-width: 1080px) {
            .login-scene {
              padding: 16px;
            }

            .login-main-shell {
              grid-template-columns: 1fr;
              border-radius: 24px;
            }

            .login-showcase {
              min-height: unset;
            }

            .login-showcase-content {
              padding: 34px 26px 26px;
            }

            .login-showcase-title {
              max-width: 100%;
            }

            .login-kpi-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .login-auth-panel {
              padding: 26px 18px 24px;
            }
          }

          @media (max-width: 820px) {
            .login-showcase {
              display: none;
            }

            .login-auth-card {
              max-width: 460px;
            }

            .login-mobile-brand {
              display: flex;
            }
          }

          @media (max-width: 480px) {
            .login-scene {
              padding: 12px;
            }

            .login-auth-panel {
              padding: 12px;
            }

            .login-auth-card {
              padding: 24px 18px;
              border-radius: 18px;
            }

            .login-form-subtitle.ant-typography {
              font-size: 13px;
            }
          }

          @keyframes loginOrbFloat {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }

          @keyframes loginButtonShift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .login-orb,
            .login-auth-card,
            .login-kpi-card,
            .login-submit-btn.ant-btn {
              animation: none !important;
              transition: none !important;
            }
          }
        `}</style>
      </div>
    </ClientOnly>
  );
}
