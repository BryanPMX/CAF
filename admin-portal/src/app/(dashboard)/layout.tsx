// admin-portal/src/app/(dashboard)/layout.tsx
'use client';

import React, { useState, useEffect, Suspense, lazy, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Spin, Button, Space, Alert } from 'antd';
import Image from 'next/image';
import { 
  HomeOutlined, 
  ScheduleOutlined, 
  TeamOutlined, 
  ShopOutlined, 
  FolderOpenOutlined, 
  LogoutOutlined, 
  BarChartOutlined, 
  FileTextOutlined 
} from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/app/lib/types';
import { NotificationProvider } from '@/context/NotificationContext';

// Lazy load components for better performance
const NotificationBell = lazy(() => import('./components/NotificationBell'));

// Destructure Layout components once
const { Header, Sider, Content } = Layout;

// Menu configuration following Single Responsibility Principle
interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  href: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'dashboard', icon: <HomeOutlined />, label: 'Dashboard', href: '/' },
  { key: 'appointments', icon: <ScheduleOutlined />, label: 'Citas', href: '/app/appointments' },
  { key: 'cases', icon: <FolderOpenOutlined />, label: 'Casos', href: '/app/cases' },
  { key: 'users', icon: <TeamOutlined />, label: 'Usuarios', href: '/app/users', adminOnly: true },
  { key: 'offices', icon: <ShopOutlined />, label: 'Oficinas', href: '/app/offices', superAdminOnly: true },
  { key: 'reports', icon: <BarChartOutlined />, label: 'Reportes', href: '/app/reports', adminOnly: true },
  { key: 'archives', icon: <FileTextOutlined />, label: 'Archivos', href: '/app/records', adminOnly: true },
];

// Loading component for lazy-loaded components
const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-4">
    <Spin size="small" />
  </div>
);

// Role display configuration
const ROLE_DISPLAY_CONFIG = {
  admin: { label: 'Administrador', color: 'bg-red-100 text-red-800' },
  office_manager: { label: 'Gerente de Oficina', color: 'bg-blue-100 text-blue-800' },
  staff: { label: 'Personal', color: 'bg-green-100 text-green-800' },
  counselor: { label: 'Consejero', color: 'bg-purple-100 text-purple-800' },
  psychologist: { label: 'Psicólogo', color: 'bg-orange-100 text-orange-800' },
  client: { label: 'Cliente', color: 'bg-gray-100 text-gray-800' },
} as const;

export default function DashboardLayout({ children }: { children: React.ReactNode; }) {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    user, 
    loading, 
    logout, 
    isAdmin, 
    isStaff, 
    error: authError 
  } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Minimal authentication check - no API calls at all
  useEffect(() => {
    if (loading) return; // Wait for auth to complete
    
    if (!user) {
      // No user, redirect to login
      window.location.href = '/login';
      return;
    }

    // Immediately set auth checked without any API calls or redirects
    setAuthChecked(true);
  }, [user, loading]); // Minimal dependencies

  // Helper function to check if user should be redirected based on role
  const checkRoleBasedRedirect = useCallback((role: UserRole, currentPath: string): string | null => {
    // Admin and office managers should be on admin routes
    if ((role === 'admin' || role === 'office_manager') && !currentPath.startsWith('/admin')) {
      return '/admin';
    }
    
    // Regular staff should not be on admin routes
    if ((role === 'staff' || role === 'counselor' || role === 'psychologist') && currentPath.startsWith('/admin')) {
      return '/';
    }
    
    return null; // No redirect needed
  }, []);

  // Get selected menu key based on current path
  const selectedKey = useMemo(() => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/app/appointments')) return 'appointments';
    if (pathname.startsWith('/app/cases')) return 'cases';
    if (pathname.startsWith('/app/users')) return 'users';
    if (pathname.startsWith('/app/offices')) return 'offices';
    if (pathname.startsWith('/app/reports')) return 'reports';
    if (pathname.startsWith('/app/records')) return 'archives';
    return 'dashboard';
  }, [pathname]);

  // Filter menu items based on user role and format for Ant Design
  const filteredMenuItems = useMemo(() => {
    return MENU_ITEMS.filter(item => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.superAdminOnly && user?.role !== 'admin') return false;
      return true;
    }).map(item => ({
      key: item.key,
      icon: item.icon,
      label: <Link href={item.href}>{item.label}</Link>,
    }));
  }, [isAdmin, user?.role]);

  // Get role display configuration
  const roleDisplay = useMemo(() => {
    if (!user?.role) return null;
    return ROLE_DISPLAY_CONFIG[user.role] || ROLE_DISPLAY_CONFIG.client;
  }, [user?.role]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spin size="large" /></div>;
  }

  return (
    // Temporarily disable NotificationProvider to isolate the infinite loop issue
    // <NotificationProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible>
          <div className="flex flex-col items-start text-white py-4 px-4">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="CAF" 
                width={32} 
                height={32} 
                onError={(e:any)=>{e.currentTarget.style.display='none';}}
                priority
              />
              <span className="text-lg font-bold">CAF</span>
            </div>
          </div>
          <Menu 
            theme="dark" 
            selectedKeys={[selectedKey]} 
            mode="inline"
            items={filteredMenuItems}
          />
        </Sider>
        
        <Layout>
          <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-800">
                {user?.firstName && user?.lastName 
                  ? `¡Bienvenido, ${user.firstName} ${user.lastName}!` 
                  : '¡Bienvenido al Sistema CAF!'}
              </h1>
              {roleDisplay && (
                <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${roleDisplay.color}`}>
                  {roleDisplay.label}
                </span>
              )}
            </div>
            
            <Space>
              {/* Temporarily disable NotificationBell */}
              {/* <Suspense fallback={<LoadingSpinner />}>
                <NotificationBell />
              </Suspense> */}
              <Button 
                type="text" 
                icon={<LogoutOutlined />} 
                onClick={logout}
                className="text-gray-600 hover:text-red-600"
              >
                Cerrar Sesión
              </Button>
            </Space>
          </Header>
          
          <Content style={{ margin: '24px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
            {authError && (
              <Alert
                message="Authentication Error"
                description={authError}
                type="error"
                showIcon
                className="mb-4"
                closable
              />
            )}
            
            {profileError && (
              <Alert
                message="Profile Error"
                description={profileError}
                type="warning"
                showIcon
                className="mb-4"
                closable
                onClose={() => setProfileError(null)}
              />
            )}
            
            {authChecked ? children : <div className="flex justify-center items-center h-64"><Spin size="large" /></div>}
          </Content>
        </Layout>
      </Layout>
    // </NotificationProvider>
  );
}





