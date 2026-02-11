// admin-portal/src/app/(dashboard)/components/SidebarBrand.tsx
// Sidebar brand: logo + organization name. Shows "CAF" when collapsed.
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function SidebarBrand() {
  const [logoError, setLogoError] = React.useState(false);

  return (
    <Link
      href="/"
      className="sidebar-brand flex items-center gap-3 px-4 py-4 min-h-[64px] w-full transition-colors hover:bg-white/[0.06]"
    >
      <div className="sidebar-brand-logo relative flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
        {!logoError ? (
          <Image
            src="/logo.png"
            alt="CAF"
            width={40}
            height={40}
            className="object-contain p-0.5"
            onError={() => setLogoError(true)}
            priority
          />
        ) : (
          <span className="text-base font-bold text-white/90">C</span>
        )}
      </div>
      <div className="sidebar-brand-label flex flex-col min-w-0 flex-1">
        <span className="text-sm font-semibold text-white leading-tight truncate">
          Centro de Apoyo
        </span>
        <span className="text-[11px] text-white/50 leading-tight truncate">
          para la Familia A.C.
        </span>
      </div>
    </Link>
  );
}
