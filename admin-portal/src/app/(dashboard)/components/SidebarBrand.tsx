// admin-portal/src/app/(dashboard)/components/SidebarBrand.tsx
// Sidebar brand: displays the organization logo prominently.
// Shows full logo when expanded, compact "CAF" mark when collapsed.
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function SidebarBrand() {
  const [logoError, setLogoError] = React.useState(false);

  return (
    <Link
      href="/"
      className="sidebar-brand flex items-center justify-center px-3 py-4 min-h-[64px] w-full transition-colors hover:bg-white/[0.06]"
    >
      <div className="sidebar-brand-logo relative flex-shrink-0 flex items-center justify-center overflow-hidden">
        {!logoError ? (
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
