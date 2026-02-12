'use client';

import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, message, Avatar, Divider, Input, Button, Space } from 'antd';
import { MailOutlined, TeamOutlined, BankOutlined, UserOutlined, UploadOutlined, LinkOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getRoleDisplayName } from '@/config/roles';
import AuthAvatar from '../../components/AuthAvatar';

const { Title, Text } = Typography;

interface ProfileData {
  userID: string | number;
  role: string;
  firstName: string;
  lastName: string;
  office?: { id: number; name: string };
  officeId?: number;
  avatarUrl?: string;
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = (firstName ?? '').trim().charAt(0).toUpperCase();
  const last = (lastName ?? '').trim().charAt(0).toUpperCase();
  if (first || last) return `${first}${last}`;
  return '?';
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await apiClient.get('/profile');
      setProfile(res.data);
      if (res.data?.avatarUrl && user) {
        updateUser({ ...user, avatarUrl: res.data.avatarUrl });
      }
    } catch {
      message.error('No se pudo cargar el perfil');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingProfile(true);
        const res = await apiClient.get('/profile');
        if (!cancelled) {
          setProfile(res.data);
          if (res.data?.avatarUrl && user) {
            updateUser({ ...user, avatarUrl: res.data.avatarUrl });
          }
        }
      } catch {
        if (!cancelled) message.error('No se pudo cargar el perfil');
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSaveAvatarUrl = async () => {
    const url = avatarUrlInput.trim();
    if (url) {
      const lower = url.toLowerCase();
      if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
        message.warning('La URL debe comenzar con http:// o https://');
        return;
      }
      if (url.length > 512) {
        message.warning('La URL no puede superar 512 caracteres');
        return;
      }
    }
    setSavingAvatar(true);
    try {
      await apiClient.patch('/profile', { avatarUrl: url || null });
      message.success('Foto de perfil actualizada');
      setAvatarUrlInput('');
      await fetchProfile();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err?.response?.data?.error || 'No se pudo actualizar la foto');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      message.error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP)');
      return;
    }
    const maxSizeMB = 2;
    if (file.size > maxSizeMB * 1024 * 1024) {
      message.error(`El archivo no debe superar ${maxSizeMB} MB`);
      return;
    }
    setSavingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await apiClient.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data?.avatarUrl;
      if (newUrl && user) {
        updateUser({ ...user, avatarUrl: newUrl });
      }
      message.success('Foto de perfil actualizada');
      await fetchProfile();
    } catch {
      message.error('No se pudo subir la imagen');
    } finally {
      setSavingAvatar(false);
      e.target.value = '';
    }
  };

  if (loadingProfile && !profile) {
    return (
      <div className="flex justify-center items-center min-h-[320px]">
        <Spin size="large" tip="Cargando perfil..." />
      </div>
    );
  }

  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Usuario';
  const initials = getInitials(profile?.firstName, profile?.lastName);
  const email = user?.email ?? '—';
  const roleLabel = getRoleDisplayName(profile?.role ?? user?.role ?? '');
  const officeName = profile?.office?.name ?? '—';

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="overflow-hidden" style={{ borderRadius: 12 }}>
        {/* Profile header: avatar + name + role */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6">
          {profile?.avatarUrl ? (
            <div className="flex-shrink-0 w-[120px] h-[120px] rounded-full overflow-hidden bg-gray-100">
              <AuthAvatar avatarUrl={profile.avatarUrl} alt={displayName} size={120} className="w-full h-full" />
            </div>
          ) : (
            <Avatar
              size={120}
              className="flex-shrink-0 !bg-indigo-100 !text-indigo-700 !text-3xl"
              icon={initials === '?' ? <UserOutlined /> : undefined}
            >
              {initials !== '?' ? initials : null}
            </Avatar>
          )}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <Title level={3} className="!mb-1 !font-semibold">
              {displayName}
            </Title>
            <Text type="secondary" className="text-base">
              {email}
            </Text>
            <div className="mt-2">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        <Divider className="!my-4" />

        {/* Essential info list */}
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
              <p className="!mb-0 font-medium text-gray-900">{email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600 shrink-0">
              <TeamOutlined />
            </span>
            <div className="min-w-0">
              <Text type="secondary" className="text-xs uppercase tracking-wide">Rol</Text>
              <p className="!mb-0 font-medium text-gray-900">{roleLabel}</p>
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

        <Divider className="!my-6" />

          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <Title level={5} className="!mb-1">Foto de perfil</Title>
            <p className="text-sm text-gray-500 mb-3">
              Sube una imagen (JPEG, PNG, GIF o WebP, máx. 2 MB) o pega una URL que comience con https://
            </p>
            <Space wrap className="w-full" size="middle">
              <Input
                placeholder="https://ejemplo.com/mi-foto.jpg"
                value={avatarUrlInput}
                onChange={(e) => setAvatarUrlInput(e.target.value)}
                onPressEnter={handleSaveAvatarUrl}
                maxLength={512}
                showCount={false}
                style={{ maxWidth: 340 }}
                prefix={<LinkOutlined className="text-gray-400" />}
                allowClear
              />
              <Button type="primary" loading={savingAvatar} onClick={handleSaveAvatarUrl} icon={<LinkOutlined />}>
                Usar URL
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button loading={savingAvatar} onClick={() => fileInputRef.current?.click()} icon={<UploadOutlined />}>
                Subir imagen
              </Button>
            </Space>
          </div>
        </div>
      </Card>
    </div>
  );
}
