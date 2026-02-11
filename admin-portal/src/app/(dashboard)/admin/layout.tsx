'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Result, Button, Spin } from 'antd';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const checkAdminAccess = () => {
      const token = localStorage.getItem('authToken');
      const userRole = localStorage.getItem('userRole');

      if (!token) {
        router.replace('/login');
        return;
      }

      // Only admins and office managers can access admin routes
      if (userRole !== 'admin' && userRole !== 'office_manager') {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setLoading(false);
    };

    checkAdminAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Result
          status="403"
          title="Acceso Denegado"
          subTitle="Solo administradores y gerentes de oficina pueden acceder a esta sección."
          extra={[
            <Button 
              type="primary" 
              key="dashboard" 
              onClick={() => router.push('/')}
            >
              Volver al Tablero
            </Button>
          ]}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminLayout;
