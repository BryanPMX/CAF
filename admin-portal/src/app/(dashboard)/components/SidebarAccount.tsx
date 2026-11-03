'use client';

import { useEffect, useState } from 'react';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useAuth } from '@/context/AuthContext';
import AuthAvatar from './AuthAvatar';

interface SidebarAccountProps {
  collapsed?: boolean;
  roleLabel: string;
  onProfile: () => void;
  onLogout: () => void;
}

function getInitials(firstName?: string, lastName?: string): string {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  return initials || 'U';
}

export default function SidebarAccount({
  collapsed = false,
  roleLabel,
  onProfile,
  onLogout,
}: SidebarAccountProps) {
  const { user } = useAuth();
  const [avatarError, setAvatarError] = useState(false);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Mi cuenta';

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  const avatar = user?.avatarUrl && !avatarError ? (
    <AuthAvatar
      avatarUrl={user.avatarUrl}
      alt="Foto de perfil"
      size={38}
      className="sidebar-account-avatar"
      onError={() => setAvatarError(true)}
    />
  ) : (
    <span className="sidebar-account-fallback" aria-hidden>{getInitials(user?.firstName, user?.lastName)}</span>
  );

  if (collapsed) {
    return (
      <div className="sidebar-account sidebar-account-collapsed">
        <Tooltip title="Mi perfil" placement="right">
          <button type="button" className="sidebar-account-avatar-button" onClick={onProfile} aria-label="Abrir mi perfil">
            {avatar}
          </button>
        </Tooltip>
        <Tooltip title="Cerrar sesión" placement="right">
          <button type="button" className="sidebar-account-logout" onClick={onLogout} aria-label="Cerrar sesión">
            <LogoutOutlined />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="sidebar-account">
      <button type="button" className="sidebar-account-profile" onClick={onProfile}>
        {avatar}
        <span className="sidebar-account-copy">
          <span className="sidebar-account-name">{fullName}</span>
          <span className="sidebar-account-role">{roleLabel}</span>
        </span>
        <UserOutlined className="sidebar-account-profile-icon" aria-hidden />
      </button>
      <Tooltip title="Cerrar sesión" placement="top">
        <button type="button" className="sidebar-account-logout" onClick={onLogout} aria-label="Cerrar sesión">
          <LogoutOutlined />
        </button>
      </Tooltip>
    </div>
  );
}
