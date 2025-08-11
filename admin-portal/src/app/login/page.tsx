// admin-portal/src/app/login/page.tsx
'use client'; // This directive marks the component as a Client Component.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { apiClient } from '../lib/api'; // We created this in a previous step

const LoginPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // This function runs when the user submits the login form.
  const onFinish = async (values: any) => {
    setLoading(true);
    // Show a loading message that won't disappear on its own.
    message.loading({ content: 'Verificando...', key: 'login', duration: 0 });

    try {
      // Use the apiClient to send the login request to the Go API.
      const response = await apiClient.post('/login', {
        email: values.email,
        password: values.password,
      });

      // On success, store the returned JWT in the browser's localStorage.
      // This is how the app "remembers" that the user is logged in.
      localStorage.setItem('authToken', response.data.token);
      
      // Update the message to show success.
      message.success({ content: '¡Inicio de sesión exitoso!', key: 'login' });
      
      // Redirect the user to the main dashboard page.
      router.push('/');

    } catch (error) {
      // If the API returns an error (e.g., 401 Unauthorized), show an error message.
      message.error({ content: 'Credenciales incorrectas. Por favor, intente de nuevo.', key: 'login' });
    } finally {
      // This block runs whether the login succeeded or failed.
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card title="Portal de Administración CAF" className="w-full max-w-md mx-4">
        <Spin spinning={loading} tip="Cargando...">
          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="email"
              rules={[{ required: true, type: 'email', message: '¡Por favor, ingrese un correo válido!' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Correo Electrónico" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '¡Por favor, ingrese su contraseña!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" className="w-full" disabled={loading}>
                INICIAR SESIÓN
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default LoginPage;
