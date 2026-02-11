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
    <Link
      href="/"
      className="sidebar-brand flex items-center gap-3 pl-4 pr-3 py-4 min-h-[64px] w-full text-left transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
    >
      <div className="sidebar-brand-logo relative flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-500/90 to-violet-600/90 flex items-center justify-center overflow-hidden shadow-lg shadow-black/20">
        {!logoError && (
          <Image
            src="/logo.png"
            alt=""
            width={44}
            height={44}
            className="object-contain p-0.5"
            onError={handleLogoError}
            priority
          />
        )}
        {logoError && (
          <span className="text-lg font-bold text-white/95 tracking-tight" aria-hidden>
            C
          </span>
        )}
      </div>
      <div className="sidebar-brand-label flex flex-col items-start justify-center min-w-0 flex-1">
        <span className="text-[1.15rem] font-semibold tracking-tight text-white leading-none">
          CAF
        </span>
        <span className="text-[10px] font-medium tracking-[0.2em] text-white/50 uppercase mt-0.5">
          Portal
        </span>
      </div>
    </Link>
  );
}
