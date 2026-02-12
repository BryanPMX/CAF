'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Typography,
  Spin,
  message,
  Avatar,
  Divider,
  Tag,
  Table,
  Button,
} from 'antd';
import {
  MailOutlined,
  TeamOutlined,
  BankOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getRoleDisplayName } from '@/config/roles';

const { Title, Text } = Typography;

interface OfficeInfo {
  id: number;
  name: string;
  address?: string;
}

interface ContactSubmissionRow {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  source: string;
  createdAt: string;
}

interface UserDetailResponse {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    phone?: string;
    officeId?: number;
    office?: OfficeInfo;
  };
  office: OfficeInfo | { id: number };
  caseAssignments: unknown[];
  totalCases: number;
  contactSubmissions?: ContactSubmissionRow[];
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = (firstName ?? '').trim().charAt(0).toUpperCase();
  const last = (lastName ?? '').trim().charAt(0).toUpperCase();
  if (first || last) return `${first}${last}`;
  return '?';
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const userId = params?.userId as string | undefined;

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const base = authUser?.role === 'office_manager' ? '/manager' : '/admin';

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`${base}/users/${userId}`);
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) message.error('No se pudo cargar el usuario');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, base]);

  const handleBack = () => router.push('/app/users');
  const handleEdit = () => router.push(`/app/users?edit=${userId}`);

  if (!userId) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => router.push('/app/users')}>
          Volver a usuarios
        </Button>
        <Card><Text type="secondary">ID de usuario no válido.</Text></Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center min-h-[320px]">
        <Spin size="large" tip="Cargando usuario..." />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={handleBack}>
          Volver a usuarios
        </Button>
        <Card><Text type="danger">Usuario no encontrado.</Text></Card>
      </div>
    );
  }

  const u = data.user;
  const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Usuario';
  const initials = getInitials(u.firstName, u.lastName);
  const officeName = (data.office && typeof data.office === 'object' && 'name' in data.office)
    ? (data.office as OfficeInfo).name
    : '—';
  const isClient = u.role === 'client';
  const contactSubmissions = data.contactSubmissions ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
          Volver a usuarios
        </Button>
        {(authUser?.role === 'admin' || authUser?.role === 'office_manager') && (
          <Button type="primary" icon={<FormOutlined />} onClick={handleEdit}>
            Editar usuario
          </Button>
        )}
      </div>

      <Card className="overflow-hidden" style={{ borderRadius: 12 }}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6">
          <Avatar
            size={100}
            className="flex-shrink-0 !bg-indigo-100 !text-indigo-700 !text-2xl"
            icon={initials === '?' ? <UserOutlined /> : undefined}
          >
            {initials !== '?' ? initials : null}
          </Avatar>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <Title level={3} className="!mb-1 !font-semibold">
              {displayName}
            </Title>
            <Text type="secondary" className="text-base">
              {u.email}
            </Text>
            <div className="mt-2">
              <Tag color="blue">{getRoleDisplayName(u.role)}</Tag>
            </div>
          </div>
        </div>

        <Divider className="!my-4" />

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600 shrink-0">
              <UserOutlined />
            </span>
            <div className="min-w-0">
              <Text type="secondary" className="text-xs uppercase tracking-wide">Nombre completo</Text>
              <p className="!mb-0 font-medium text-gray-900">{displayName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600 shrink-0">
              <MailOutlined />
            </span>
            <div className="min-w-0">
              <Text type="secondary" className="text-xs uppercase tracking-wide">Correo electrónico</Text>
              <p className="!mb-0 font-medium text-gray-900">{u.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600 shrink-0">
              <TeamOutlined />
            </span>
            <div className="min-w-0">
              <Text type="secondary" className="text-xs uppercase tracking-wide">Rol</Text>
              <p className="!mb-0 font-medium text-gray-900">{getRoleDisplayName(u.role)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600 shrink-0">
              <BankOutlined />
            </span>
            <div className="min-w-0">
              <Text type="secondary" className="text-xs uppercase tracking-wide">Oficina</Text>
              <p className="!mb-0 font-medium text-gray-900">{officeName}</p>
            </div>
          </div>
          {u.phone && (
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600 shrink-0">
                <MailOutlined />
              </span>
              <div className="min-w-0">
                <Text type="secondary" className="text-xs uppercase tracking-wide">Teléfono</Text>
                <p className="!mb-0 font-medium text-gray-900">{u.phone}</p>
              </div>
            </div>
          )}
        </div>

        {isClient && contactSubmissions.length > 0 && (
          <>
            <Divider className="!my-6" />
            <Title level={5} className="!mb-3">
              Mensajes Web
            </Title>
            <Table
              dataSource={contactSubmissions}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Fecha',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 120,
                  render: (createdAt: string) =>
                    new Date(createdAt).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                },
                {
                  title: 'Mensaje',
                  dataIndex: 'message',
                  key: 'message',
                  ellipsis: true,
                  render: (msg: string) => (
                    <span title={msg}>
                      {msg.length > 80 ? `${msg.slice(0, 80)}…` : msg}
                    </span>
                  ),
                },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
}
