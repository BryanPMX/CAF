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

  useEffect(() => {
    setAvatarLoadError(false);
  }, [user?.avatarUrl]);

  return (
    <Link
      href="/app/profile"
      className="sidebar-brand flex items-center justify-center px-3 py-4 min-h-[64px] w-full transition-colors hover:bg-white/[0.06]"
      aria-label="Ir a mi perfil"
    >
      <div className="sidebar-brand-logo relative flex-shrink-0 flex items-center justify-center overflow-hidden rounded-full">
        {hasAvatar ? (
          <AuthAvatar
            avatarUrl={user!.avatarUrl}
            alt="Mi perfil"
            size={48}
            className="sidebar-brand-img object-cover"
            onError={() => setAvatarLoadError(true)}
          />
        ) : !logoError ? (
          <Image
            src="/logo.png"
            alt="CAF - Centro de Apoyo para la Familia"
            width={140}
            height={48}
            className="object-contain sidebar-brand-img"
            onError={() => setLogoError(true)}
            priority
            style={{ maxHeight: 48, width: 'auto' }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-base font-bold text-white">C</span>
            </div>
            <span className="sidebar-brand-label text-sm font-bold text-white tracking-wide">CAF</span>
          </div>
        )}
      </div>
    </Link>
  );
}
