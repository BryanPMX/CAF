// admin-portal/src/app/(dashboard)/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Spin, Button, message } from 'antd';
import { HomeOutlined, ScheduleOutlined, TeamOutlined, ShopOutlined, FolderOpenOutlined, LogoutOutlined } from '@ant-design/icons';
import { apiClient } from '../lib/api';

const { Header, Sider, Content } = Layout;

interface User { id: number; role: string; }

export default function DashboardLayout({ children }: { children: React.ReactNode; }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.replace('/login');
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const response = await apiClient.get('/profile');
        const userData = {
          id: parseInt(response.data.userID, 10),
          role: response.data.role,
        };
        setUser(userData);
        // Save the role to localStorage for other components to use
        localStorage.setItem('userRole', userData.role);
      } catch (error) {
        message.error('Session invalid. Please log in again.');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    router.replace('/login');
  };

  const getSelectedKey = () => {
    if (pathname.startsWith('/app/appointments')) return 'appointments';
    if (pathname.startsWith('/app/cases')) return 'cases';
    if (pathname.startsWith('/app/users')) return 'users';
    if (pathname.startsWith('/app/offices')) return 'offices';
    return 'dashboard'; // Default key for the main dashboard
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spin size="large" /></div>;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div className="text-white text-lg font-bold text-center py-4">CAF Admin</div>
        <Menu theme="dark" selectedKeys={[getSelectedKey()]} mode="inline">
          <Menu.Item key="dashboard" icon={<HomeOutlined />}>
            <Link href="/">Dashboard</Link>
          </Menu.Item>
          <Menu.Item key="appointments" icon={<ScheduleOutlined />}>
            <Link href="/app/appointments">Citas</Link>
          </Menu.Item>
          <Menu.Item key="cases" icon={<FolderOpenOutlined />}>
            <Link href="/app/cases">Casos</Link>
          </Menu.Item>
          
          {user?.role === 'admin' && (
            <Menu.Item key="users" icon={<TeamOutlined />}>
              <Link href="/app/users">Usuarios</Link>
            </Menu.Item>
          )}
          {user?.role === 'admin' && (
            <Menu.Item key="offices" icon={<ShopOutlined />}>
              <Link href="/app/offices">Oficinas</Link>
            </Menu.Item>
          )}
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: '0 16px', background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>Cerrar Sesión</Button>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div style={{ padding: 24, minHeight: 360, background: '#fff', borderRadius: 8 }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}





