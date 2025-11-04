// admin-portal/src/app/(dashboard)/layout.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Spin, Button, Space, Alert } from 'antd';
import Image from 'next/image';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/app/lib/types';
import { 
  getNavigationItemsForRole, 
  getRoleDefinition, 
  STAFF_ROLES,
  type StaffRoleKey 
} from '@/config/roles';
import ClientOnly from '@/components/ClientOnly';
import ErrorBoundary from '@/components/ErrorBoundary';

// Destructure Layout components once
const { Header, Sider, Content } = Layout;

// Role display configuration - now using centralized role definitions
const ROLE_DISPLAY_CONFIG = {
  'admin': { label: 'Administrador', color: 'bg-red-100 text-red-800' },
  'office_manager': { label: 'Gerente de Oficina', color: 'bg-blue-100 text-blue-800' },
  'lawyer': { label: 'Abogado/a', color: 'bg-green-100 text-green-800' },
  'psychologist': { label: 'Psicólogo/a', color: 'bg-purple-100 text-purple-800' },
  'receptionist': { label: 'Recepcionista', color: 'bg-orange-100 text-orange-800' },
  'event_coordinator': { label: 'Coordinador/a de Eventos', color: 'bg-yellow-100 text-yellow-800' },
  'client': { label: 'Cliente', color: 'bg-gray-100 text-gray-800' },
} as const;

export default function DashboardLayout({ children }: { children: React.ReactNode; }) {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    user, 
    isLoading, 
    isAuthenticated,
    logout, 
    isAdmin, 
    isStaff
  } = useAuth();
  const [profileError, setProfileError] = useState<string | null>(null);

  // Robust authentication guard - prevents infinite loading loops
  useEffect(() => {
    // CRITICAL: Only redirect if we're not loading AND not authenticated
    // This prevents race conditions and infinite loading loops
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }
  }, [isLoading, isAuthenticated, router]);

  // Helper function to check if user should be redirected based on role
  const checkRoleBasedRedirect = useCallback((role: UserRole, currentPath: string): string | null => {
    // Admin and office managers can access all routes - no forced redirect
    // Regular staff should not be on admin routes (though admin section is now removed)
    if ((role === 'lawyer' || role === 'psychologist' || role === 'receptionist' || role === 'event_coordinator') && currentPath.startsWith('/admin')) {
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
    if (pathname.startsWith('/app/records')) return 'records';
    return 'dashboard';
  }, [pathname]);

  // Filter menu items based on user role using centralized role configuration
  const filteredMenuItems = useMemo(() => {
    if (!user?.role) return [];
    
    // Convert user role to StaffRoleKey if it's a valid staff role
    const staffRole = user.role as StaffRoleKey;
    const navigationItems = getNavigationItemsForRole(staffRole);
    
    // Convert navigation items to Ant Design menu format
     return navigationItems.map(item => ({
       key: item.key,
       icon: React.createElement(require('@ant-design/icons')[item.icon || 'HomeOutlined']),
       label: <Link href={item.path}>{item.label}</Link>,
     }));
  }, [user?.role]);

  // Get role display configuration using centralized role definitions
  const roleDisplay = useMemo(() => {
    if (!user?.role) return null;
    
    // Check if it's a staff role first
    if (Object.keys(STAFF_ROLES).includes(user.role)) {
      const roleDef = getRoleDefinition(user.role);
      return {
        label: roleDef.spanishName,
        color: ROLE_DISPLAY_CONFIG[user.role as keyof typeof ROLE_DISPLAY_CONFIG]?.color || 'bg-gray-100 text-gray-800'
      };
    }
    
    // Fallback for client role
    return ROLE_DISPLAY_CONFIG.client;
  }, [user?.role]);

  // CRITICAL: Show loading spinner while auth state is being initialized
  // This prevents any child pages from rendering before auth state is known
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  // CRITICAL: Only redirect if we're not loading AND not authenticated
  // This is the correct, race-condition-free pattern
  if (!isLoading && !isAuthenticated) {
    // Show loading while redirecting to prevent flash of content
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ClientOnly fallback={<div className="flex items-center justify-center min-h-screen"><Spin size="large" /></div>}>
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
                  ? `Bienvenido, ${user.firstName} ${user.lastName}`
                  : user?.firstName
                  ? `Bienvenido, ${user.firstName}`
                  : '¡Bienvenido al Sistema CAF!'}
              </h1>
              {roleDisplay && (
                <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${roleDisplay.color}`}>
                  {roleDisplay.label}
                </span>
              )}
            </div>
            
            <Space>
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
            
            {children}
          </Content>
        </Layout>
        </Layout>
      </ClientOnly>
    </ErrorBoundary>
  );
}





