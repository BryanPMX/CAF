// admin-portal/src/app/(dashboard)/components/SidebarBrand.tsx
// Sidebar brand: user avatar when set, otherwise organization logo. Click goes to profile.
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import AuthAvatar from './AuthAvatar';

export default function SidebarBrand() {
  const [logoError, setLogoError] = React.useState(false);
  const [avatarLoadError, setAvatarLoadError] = React.useState(false);
  const { user } = useAuth();
  const hasAvatar = Boolean(user?.avatarUrl) && !avatarLoadError;
  const profileLabel = user?.firstName ? `Hola, ${user.firstName}` : 'Centro de Apoyo para la Familia';

  useEffect(() => {
    setAvatarLoadError(false);
  }, [user?.avatarUrl]);

  return (
    <Link
      href="/app/profile"
      className="sidebar-brand group flex items-center gap-3 px-4 py-5 w-full transition-colors"
      aria-label="Ir a mi perfil"
    >
      <div className="sidebar-brand-logo relative flex-shrink-0 flex items-center justify-center overflow-hidden rounded-2xl w-16 h-16">
        {hasAvatar ? (
          <AuthAvatar
            avatarUrl={user!.avatarUrl}
            alt="Mi perfil"
            size={64}
            className="sidebar-brand-img object-cover w-full h-full"
            onError={() => setAvatarLoadError(true)}
          />
        ) : !logoError ? (
          <Image
            src="/logo.png"
            alt="CAF - Centro de Apoyo para la Familia"
            width={64}
            height={64}
            className="object-contain sidebar-brand-img w-full h-full"
            onError={() => setLogoError(true)}
            priority
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-base font-bold text-white">C</span>
          </div>
        )}
      </div>
      <div className="sidebar-brand-copy min-w-0">
        <p className="sidebar-brand-title">CAF Admin</p>
        <p className="sidebar-brand-subtitle truncate">{profileLabel}</p>
      </div>
    </Link>
  );
}
