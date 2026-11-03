'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function SidebarBrand() {
  const [logoError, setLogoError] = useState(false);

  return (
    <Link
      href="/"
      className="sidebar-brand group flex w-full items-center gap-3 px-3 py-3.5"
      aria-label="Ir al panel de control"
    >
      <span className="sidebar-brand-logo relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl">
        {!logoError ? (
          <Image
            src="/logo.png"
            alt="CAF"
            width={38}
            height={46}
            className="sidebar-brand-img h-10 w-8 object-cover"
            onError={() => setLogoError(true)}
            priority
          />
        ) : (
          <span className="text-base font-bold text-white">CAF</span>
        )}
      </span>
      <span className="sidebar-brand-copy min-w-0">
        <span className="sidebar-brand-title block">CAF</span>
        <span className="sidebar-brand-subtitle block truncate">Administración</span>
      </span>
    </Link>
  );
}
