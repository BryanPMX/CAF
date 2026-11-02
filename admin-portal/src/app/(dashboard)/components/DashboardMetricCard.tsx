'use client';

import Link from 'next/link';
import { ArrowRightOutlined } from '@ant-design/icons';

export type DashboardAccent = 'blue' | 'cyan' | 'amber' | 'emerald' | 'violet' | 'rose';

interface DashboardMetricCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  accent: DashboardAccent;
  href?: string;
}

const ACCENTS: Record<DashboardAccent, { icon: string; border: string; glow: string }> = {
  blue: { icon: 'bg-blue-50 text-blue-700', border: 'border-blue-100', glow: 'from-blue-500/10' },
  cyan: { icon: 'bg-cyan-50 text-cyan-700', border: 'border-cyan-100', glow: 'from-cyan-500/10' },
  amber: { icon: 'bg-amber-50 text-amber-700', border: 'border-amber-100', glow: 'from-amber-500/10' },
  emerald: { icon: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-100', glow: 'from-emerald-500/10' },
  violet: { icon: 'bg-violet-50 text-violet-700', border: 'border-violet-100', glow: 'from-violet-500/10' },
  rose: { icon: 'bg-rose-50 text-rose-700', border: 'border-rose-100', glow: 'from-rose-500/10' },
};

export default function DashboardMetricCard({
  title,
  value,
  description,
  icon,
  accent,
  href,
}: DashboardMetricCardProps) {
  const colors = ACCENTS[accent];
  const card = (
    <div className={`group relative h-full overflow-hidden rounded-[26px] border ${colors.border} bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.1)]`}>
      <div aria-hidden className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${colors.glow} to-transparent`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value.toLocaleString('es-MX')}</p>
          <p className="mt-2 text-sm leading-5 text-slate-500">{description}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${colors.icon}`}>
          {icon}
        </span>
      </div>
      {href && (
        <div className="relative mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600 transition group-hover:text-slate-950">
          Ver detalle <ArrowRightOutlined />
        </div>
      )}
    </div>
  );

  return href ? <Link href={href} className="block h-full">{card}</Link> : card;
}
