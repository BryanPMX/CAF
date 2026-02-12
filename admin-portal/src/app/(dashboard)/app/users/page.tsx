// admin-portal/src/app/(dashboard)/admin/users/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button, Table, message, Spin, Tag, Popconfirm, Select, Space } from 'antd';
import { useSearchParams, useRouter } from 'next/navigation';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { STAFF_ROLES, PERMISSIONS, getAllRoles } from '@/config/roles';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/app/lib/api';
import UserModal from './components/UserModal'; // Import our reusable modal

// Define the TypeScript interface for a User object to ensure type safety.
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  officeId?: number;
  office?: { name: string };
  phone?: string;
  personalAddress?: string;
}

interface Office { id: number; name: string; }

const UserManagementPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHydrated = useHydrationSafe();
  // --- State Management ---
  // `users`: An array to hold the list of users fetched from the API.
  const [users, setUsers] = useState<User[]>([]);
  // `loading`: A boolean to control the visibility of the loading spinner.
  const [loading, setLoading] = useState(true);
  // `isModalVisible`: A boolean to control whether the create/edit modal is open or closed.
  const [isModalVisible, setIsModalVisible] = useState(false);
  // `editingUser`: Holds the data of the user being edited. If it's null, the modal is in "create" mode.
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<number | undefined>(undefined);
  const [activity, setActivity] = useState<string | undefined>(undefined);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [q, setQ] = useState<string>("");
  const [debouncedQ, setDebouncedQ] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const { user } = useAuth();

  // --- Data Fetching ---
  // This function fetches the list of all users from our secure admin API endpoint.
  const fetchUsers = async (forceRefresh: boolean = false) => {
    try {
      // Wait for user to be loaded before fetching
      // User role is guaranteed to be available by the parent layout
      // No need to check for user?.role since the dashboard layout ensures it exists

      setLoading(true);
      // User role is guaranteed to be available by the parent layout
       const base = user!.role === 'office_manager' ? '/manager' : '/admin';
      const params: any = {};
      if (selectedOfficeId) params.officeId = selectedOfficeId;
      if (activity) params.activity = activity;
      if (roleFilter) params.role = roleFilter;
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      params.page = page;
      params.pageSize = pageSize;
      // Add cache-busting timestamp if force refresh
      if (forceRefresh) params._t = Date.now();
      const response = await apiClient.get(`${base}/users`, { params });
      const data = response.data;
      setUsers(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      message.error('No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  // The `useEffect` hook runs this function once when the component is first mounted.
  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration to complete
    
    // User role is guaranteed to be available by the parent layout
    if (user) {
      setUserRole(user.role);
    }
    // Initialize filters from URL or sessionStorage
    const officeFromUrl = searchParams.get('officeId');
    const activityFromUrl = searchParams.get('activity');
    const roleFromUrl = searchParams.get('role');
    const qFromUrl = searchParams.get('q');
    const pageFromUrl = searchParams.get('page');
    const pageSizeFromUrl = searchParams.get('pageSize');
    const ssOffice = typeof window !== 'undefined' ? sessionStorage.getItem('users_officeId') : null;
    const ssActivity = typeof window !== 'undefined' ? sessionStorage.getItem('users_activity') : null;
    const ssRole = typeof window !== 'undefined' ? sessionStorage.getItem('users_role') : null;
    const ssQ = typeof window !== 'undefined' ? sessionStorage.getItem('users_q') : null;
    if (officeFromUrl) setSelectedOfficeId(Number(officeFromUrl));
    else if (ssOffice) setSelectedOfficeId(Number(ssOffice));
    if (activityFromUrl) setActivity(activityFromUrl);
    else if (ssActivity) setActivity(ssActivity);
    if (roleFromUrl) setRoleFilter(roleFromUrl);
    else if (ssRole) setRoleFilter(ssRole);
    if (qFromUrl) { setQ(qFromUrl); setDebouncedQ(qFromUrl); }
    else if (ssQ) { setQ(ssQ); setDebouncedQ(ssQ); }
    if (pageFromUrl) setPage(Number(pageFromUrl));
    if (pageSizeFromUrl) setPageSize(Number(pageSizeFromUrl));
    fetchUsers();
    // Only admins can load office list for filtering
    // User role is guaranteed to be available by the parent layout
     if (user && (PERMISSIONS[user.role as keyof typeof PERMISSIONS]?.includes('manage_offices') || PERMISSIONS[user.role as keyof typeof PERMISSIONS]?.includes('*'))) {
      // Use appropriate endpoint based on user role
      const endpoint = user.role === 'admin' ? '/admin/offices' : '/offices';
      apiClient.get(endpoint).then(res => setOffices(res.data)).catch(() => {});
    }
    // Intentionally omit fetchUsers/searchParams from deps: run once when hydrated and user is set; re-running on fetchUsers identity would cause redundant fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, user]);

  useEffect(() => {
    // Persist filters to sessionStorage and URL; refetch
    if (typeof window !== 'undefined') {
      if (selectedOfficeId) sessionStorage.setItem('users_officeId', String(selectedOfficeId));
      else sessionStorage.removeItem('users_officeId');
      if (activity) sessionStorage.setItem('users_activity', activity);
      else sessionStorage.removeItem('users_activity');
      if (roleFilter) sessionStorage.setItem('users_role', roleFilter);
      else sessionStorage.removeItem('users_role');
      if (debouncedQ.trim()) sessionStorage.setItem('users_q', debouncedQ.trim());
      else sessionStorage.removeItem('users_q');
    }
    const url = new URL(window.location.href);
    if (selectedOfficeId) url.searchParams.set('officeId', String(selectedOfficeId)); else url.searchParams.delete('officeId');
    if (activity) url.searchParams.set('activity', activity); else url.searchParams.delete('activity');
    if (roleFilter) url.searchParams.set('role', roleFilter); else url.searchParams.delete('role');
    if (debouncedQ.trim()) url.searchParams.set('q', debouncedQ.trim()); else url.searchParams.delete('q');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    router.replace(url.pathname + url.search);
    
    // Only fetch users when filters actually change, not on every render
    // This prevents excessive API calls
    const shouldFetch = selectedOfficeId !== undefined || activity !== undefined || 
                       roleFilter !== undefined || debouncedQ.trim() !== "" || 
                       page !== 1 || pageSize !== 20;
    
    if (shouldFetch) {
      fetchUsers();
    }
    // Omit fetchUsers and router: we only want to run when filter state changes; fetchUsers is stable in practice and router is stable from Next.js.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOfficeId, activity, roleFilter, debouncedQ, page, pageSize]);

  // Debounce free-text search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  // Open edit modal when navigating from user profile (e.g. /app/users?edit=123)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || !user?.role) return;
    const base = user.role === 'office_manager' ? '/manager' : '/admin';
    (async () => {
      try {
        const res = await apiClient.get(`${base}/users/${editId}`);
        const u = res.data?.user;
        if (u) {
          setEditingUser({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            officeId: u.officeId,
            office: u.office,
            phone: u.phone,
            personalAddress: u.personalAddress,
          });
          setIsModalVisible(true);
        }
        router.replace('/app/users');
      } catch {
        // ignore
      }
    })();
  }, [searchParams, user?.role, router]);

  // --- Event Handlers ---
  // Opens the modal in "create" mode by ensuring `editingUser` is null.
  const handleCreate = () => {
    setEditingUser(null);
    setIsModalVisible(true);
  };

  // Opens the modal in "edit" mode by passing the selected user's data.
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalVisible(true);
  };

  // Handles the user deletion after the admin confirms in the pop-up.
  const handleDelete = async (userId: number) => {
    try {
      message.loading({ content: 'Eliminando...', key: 'deleteUser' });
      await apiClient.delete(`/admin/users/${userId}`);
      message.success({ content: 'Usuario eliminado exitosamente.', key: 'deleteUser' });
      fetchUsers(); // Refresh the user list to reflect the deletion.
    } catch (error) {
      message.error({ content: 'No se pudo eliminar el usuario.', key: 'deleteUser' });
    }
  };

  // --- Table Configuration ---
  // Defines the columns for the Ant Design table.
  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: User) => `${record.firstName} ${record.lastName}`,
    },
    {
      title: 'Correo Electrónico',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const MAP: Record<string, { label: string; color: string }> = {
          admin: { label: 'Administrador', color: 'purple' },
          staff: { label: 'Personal', color: 'blue' },
          receptionist: { label: 'Recepción', color: 'geekblue' },
          client: { label: 'Cliente', color: 'green' },
          manager: { label: 'Gerencia', color: 'gold' },
          lawyer: { label: 'Abogado(a)', color: 'volcano' },
          psychologist: { label: 'Psicólogo(a)', color: 'orange' },
          office_manager: { label: 'Gerente de Oficina', color: 'gold' },
          event_coordinator: { label: 'Coordinador de Eventos', color: 'cyan' },
        };
        const { label, color } = MAP[role] || { label: role, color: 'default' };
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Oficina',
      dataIndex: ['office', 'name'], // Ant Design can access nested data with an array.
      key: 'office',
      render: (name: string) => name || 'N/A', // Display 'N/A' if no office is assigned.
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: User) => (
        (userRole === 'admin' || userRole === 'office_manager') ? (
          <span className="space-x-2">
            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            {userRole === 'admin' && (
              <Popconfirm
                title="¿Está seguro de que desea eliminar este usuario?"
                onConfirm={() => handleDelete(record.id)}
                okText="Sí"
                cancelText="No"
              >
                <Button icon={<DeleteOutlined />} danger />
              </Popconfirm>
            )}
          </span>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Gestión de Usuarios</h1>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {(userRole === 'admin' || userRole === 'office_manager') && (
              <>
                {userRole === 'admin' && (
                  <Select
                    allowClear
                    placeholder="Filtrar por Oficina"
                    style={{ minWidth: 220 }}
                    value={selectedOfficeId}
                    onChange={(v: number | undefined) => setSelectedOfficeId(v)}
                    options={offices.map(o => ({ label: o.name, value: o.id }))}
                  />
                )}
                <Select
                  allowClear
                  placeholder="Actividad"
                  style={{ minWidth: 180 }}
                  value={activity}
                  onChange={(v: string | undefined) => setActivity(v)}
                  options={[
                    { label: 'Activos (24h)', value: 'active' },
                    { label: 'Inactivos (30d+)', value: 'inactive' },
                  ]}
                />
                <Select
                  allowClear
                  placeholder="Rol"
                  style={{ minWidth: 200 }}
                  value={roleFilter}
                  onChange={(v: string | undefined) => setRoleFilter(v)}
                   options={getAllRoles().map(role => ({ label: role.label, value: role.value }))}
                />
                <input
                  placeholder="Buscar por nombre o correo"
                  value={q}
                  onChange={(e) => { setPage(1); setQ(e.target.value); }}
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #d9d9d9', 
                    borderRadius: '6px', 
                    minWidth: 260,
                    fontSize: '14px',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#1890ff';
                    e.target.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d9d9d9';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </>
            )}
          </div>
          {(userRole === 'admin' || userRole === 'office_manager') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Crear Usuario
            </Button>
          )}
        </div>
      </div>
      <div className="bg-white rounded-lg">
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
              showSizeChanger: true,
              showTotal: (t) => `${t} usuarios`,
            }}
            className="rounded-lg"
            locale={{ emptyText: 'No hay usuarios registrados.' }}
          />
        </Spin>
      </div>
      <UserModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={() => fetchUsers(true)} // Force refresh after user creation/update
        user={editingUser}
      />
    </div>
  );
};

export default UserManagementPage;

