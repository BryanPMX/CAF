'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Sidebar brand block: logo + "CAF" + "Portal".
 * Single responsibility: present the app brand and link to home.
 * Handles logo load failure with a fallback initial.
 */
export default function SidebarBrand() {
  const [logoError, setLogoError] = React.useState(false);

  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    setLogoError(true);
  };

  return (
    <Link href="/" className="sidebar-brand block border-b border-white/10">
      <div className="flex flex-col items-center justify-center text-white py-5 pl-4 pr-4 min-h-[72px]">
        <div className="flex items-center gap-3 w-full justify-start">
          <div className="relative flex-shrink-0 w-[72px] min-w-[72px] h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden ring-1 ring-white/5">
            {!logoError && (
              <Image
                src="/logo.png"
                alt=""
                width={72}
                height={40}
                className="object-contain object-left"
                onError={handleLogoError}
                priority
              />
            )}
            {logoError && (
              <span className="text-lg font-bold tracking-wider text-white" aria-hidden>
                C
              </span>
            )}
          </div>
          <div className="sidebar-brand-label flex flex-col items-start min-w-0">
            <span className="text-xl font-bold tracking-widest text-white leading-tight">
              CAF
            </span>
            <span className="text-[11px] font-medium text-white/70 tracking-widest uppercase">
              Portal
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
