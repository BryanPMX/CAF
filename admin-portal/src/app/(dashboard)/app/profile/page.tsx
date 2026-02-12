'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Descriptions, Typography, Spin, message, Table, Tag, Empty } from 'antd';
import { IdcardOutlined, MailOutlined, TeamOutlined, BankOutlined, UserOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getRoleDisplayName } from '@/config/roles';

const { Title, Text } = Typography;

interface ProfileData {
  userID: string | number;
  role: string;
  firstName: string;
  lastName: string;
  office?: { id: number; name: string };
  officeId?: number;
}

interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  source: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [contactSubmissions, setContactSubmissions] = useState<ContactSubmission[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingContactos, setLoadingContactos] = useState(false);
  const contactosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingProfile(true);
        const res = await apiClient.get('/profile');
        if (!cancelled) setProfile(res.data);
      } catch {
        if (!cancelled) message.error('No se pudo cargar el perfil');
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingContactos(true);
        const res = await apiClient.get('/admin/contact-submissions', { params: { page: 1, limit: 50 } });
        if (!cancelled && res.data?.data) setContactSubmissions(res.data.data);
      } catch {
        if (!cancelled) message.error('No se pudieron cargar los intereses de contacto');
      } finally {
        if (!cancelled) setLoadingContactos(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (typeof window === 'undefined' || !contactosRef.current) return;
    if (window.location.hash === '#contactos') {
      contactosRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loadingContactos]);

  if (loadingProfile && !profile) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Spin size="large" tip="Cargando perfil..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Title level={2} className="!mb-0">
        <IdcardOutlined className="mr-2" />
        Mi perfil
      </Title>

      <Card title="Datos de la cuenta" loading={loadingProfile}>
        <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size="small">
          <Descriptions.Item label={<><UserOutlined className="mr-1" /> Nombre</>}>
            {profile?.firstName} {profile?.lastName}
          </Descriptions.Item>
          <Descriptions.Item label={<><MailOutlined className="mr-1" /> Correo</>}>
            {user?.email ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label={<><TeamOutlined className="mr-1" /> Rol</>}>
            <Tag color="blue">{getRoleDisplayName(profile?.role ?? user?.role ?? '')}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={<><BankOutlined className="mr-1" /> Oficina</>}>
            {profile?.office?.name ?? '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {isAdmin && (
        <div ref={contactosRef} id="contactos">
          <Card
            title="Intereses desde Contacto (sitio web)"
            loading={loadingContactos}
            extra={
              <Text type="secondary">
                {contactSubmissions.length} registro(s)
              </Text>
            }
          >
            {contactSubmissions.length === 0 && !loadingContactos ? (
              <Empty description="No hay mensajes de contacto aún" />
            ) : (
              <Table
                dataSource={contactSubmissions}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                size="small"
                columns={[
                  {
                    title: 'Nombre',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name: string) => <Text strong>{name}</Text>,
                  },
                  {
                    title: 'Correo',
                    dataIndex: 'email',
                    key: 'email',
                    render: (email: string) => (
                      <a href={`mailto:${email}`}>{email}</a>
                    ),
                  },
                  {
                    title: 'Teléfono',
                    dataIndex: 'phone',
                    key: 'phone',
                    render: (phone: string) => phone || '—',
                  },
                  {
                    title: 'Mensaje',
                    dataIndex: 'message',
                    key: 'message',
                    ellipsis: true,
                    render: (msg: string) => (
                      <span title={msg}>
                        {msg.length > 60 ? `${msg.slice(0, 60)}…` : msg}
                      </span>
                    ),
                  },
                  {
                    title: 'Fecha',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    width: 120,
                    render: (createdAt: string) =>
                      new Date(createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
