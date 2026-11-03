'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Spin } from 'antd';
import {
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/app/lib/api';
import type { LoginFormData, LoginResponse, UserRole } from '@/app/lib/types';
import { handleApiError, logApiSuccess } from '@/app/lib/logger';
import { logVersionInfo, isCorrectDomain } from '@/app/lib/version';
import ClientOnly from '@/components/ClientOnly';
import { useAuth } from '@/context/AuthContext';
import styles from './login.module.css';

const ROLE_REDIRECTS: Record<UserRole, string> = {
  admin: '/',
  office_manager: '/',
  lawyer: '/',
  psychologist: '/',
  receptionist: '/',
  event_coordinator: '/',
  client: '/',
};

function getLoginError(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return 'El correo o la contraseña no son correctos.';
    if (status === 429) return 'Demasiados intentos. Espere unos minutos antes de volver a intentarlo.';
  }
  return 'No fue posible iniciar sesión. Verifique su conexión e intente nuevamente.';
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
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
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const clearLoginErrors = useCallback(() => {
    if (loginError) setLoginError(null);
    if (authError) clearError();
  }, [authError, clearError, loginError]);

  const handleLogin = useCallback(async (values: LoginFormData) => {
    setLoading(true);
    setLoginError(null);
    clearError();

    try {
      const response = await apiClient.post<LoginResponse>('/login', {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (!response.data.token || !response.data.user) {
        throw new Error('Invalid authentication response');
      }

      login(response.data.user, response.data.token);
      logApiSuccess('User authenticated', 'LoginPage');
      router.replace(ROLE_REDIRECTS[response.data.user.role] || '/');
    } catch (error: unknown) {
      handleApiError(error, 'LoginPage');
      setLoginError(getLoginError(error));
    } finally {
      setLoading(false);
    }
  }, [clearError, login, router]);

  if (!mounted || isAuthenticated) {
    return (
      <div className={styles.loading} aria-label="Cargando acceso">
        <Spin size="large" />
      </div>
    );
  }

  const visibleError = loginError || authError;

  return (
    <ClientOnly>
      <main className={styles.page}>
        <div className={styles.ambientTop} aria-hidden />
        <div className={styles.ambientBottom} aria-hidden />

        <section className={styles.card} aria-labelledby="login-title">
          <header className={styles.brandHeader}>
            <div className={styles.logoFrame}>
              <Image
                src="/logo.png"
                alt="Centro de Apoyo para la Familia"
                width={48}
                height={60}
                className={styles.logo}
                priority
              />
            </div>
            <div className={styles.brandCopy}>
              <span className={styles.brandName}>CAF</span>
              <span className={styles.organization}>Centro de Apoyo para la Familia A.C.</span>
            </div>
          </header>

          <div className={styles.divider} />

          <div className={styles.formHeader}>
            <span className={styles.accessLabel}>Acceso institucional</span>
            <h1 id="login-title" className={styles.title}>Iniciar sesión</h1>
            <p className={styles.subtitle}>Ingrese sus credenciales para continuar.</p>
          </div>

          {visibleError && (
            <Alert
              showIcon
              closable
              type="error"
              message="No se pudo iniciar sesión"
              description={visibleError}
              className={styles.alert}
              onClose={() => {
                setLoginError(null);
                clearError();
              }}
            />
          )}

          <Form<LoginFormData>
            name="caf-login"
            layout="vertical"
            requiredMark={false}
            autoComplete="on"
            onFinish={handleLogin}
            onValuesChange={clearLoginErrors}
          >
            <Form.Item
              name="email"
              label="Correo electrónico"
              rules={[
                { required: true, message: 'Ingrese su correo electrónico.' },
                { type: 'email', message: 'Ingrese un correo electrónico válido.' },
              ]}
            >
              <Input
                autoFocus
                autoComplete="username"
                inputMode="email"
                prefix={<MailOutlined aria-hidden />}
                placeholder="nombre@caf-mexico.com"
                className={styles.input}
                disabled={loading}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Contraseña"
              rules={[{ required: true, message: 'Ingrese su contraseña.' }]}
              className={styles.passwordItem}
            >
              <Input.Password
                autoComplete="current-password"
                prefix={<LockOutlined aria-hidden />}
                className={styles.input}
                disabled={loading}
                onKeyUp={(event) => setCapsLockActive(event.getModifierState('CapsLock'))}
                onKeyDown={(event) => setCapsLockActive(event.getModifierState('CapsLock'))}
                onBlur={() => setCapsLockActive(false)}
              />
            </Form.Item>

            <div className={styles.formStatus} aria-live="polite">
              {capsLockActive && (
                <span className={styles.capsLockNotice}>
                  <WarningOutlined aria-hidden /> Bloq Mayús está activado
                </span>
              )}
            </div>

            <Button
              block
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={loading}
              className={styles.submit}
            >
              <span>{loading ? 'Verificando…' : 'Continuar'}</span>
              {!loading && <ArrowRightOutlined aria-hidden />}
            </Button>
          </Form>

          <footer className={styles.footer}>
            <SafetyCertificateOutlined aria-hidden />
            <span>Conexión protegida</span>
          </footer>
        </section>
      </main>
    </ClientOnly>
  );
}
