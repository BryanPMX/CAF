'use client';

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

interface StatusDistributionChartProps {
  title: string;
  description: string;
  totalLabel: string;
  segments: ChartSegment[];
}

export default function StatusDistributionChart({
  title,
  description,
  totalLabel,
  segments,
}: StatusDistributionChartProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  let offset = 0;

  return (
    <section className="h-full rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[190px_minmax(0,1fr)]">
        <div className="relative mx-auto h-[180px] w-[180px]" role="img" aria-label={`${title}: ${total} ${totalLabel}`}>
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" strokeWidth="14" />
            {total > 0 && segments.map((segment) => {
              const percentage = (Math.max(0, segment.value) / total) * 100;
              const currentOffset = offset;
              offset += percentage;
              return (
                <circle
                  key={segment.label}
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="14"
                  pathLength="100"
                  strokeDasharray={`${percentage} ${100 - percentage}`}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-semibold text-slate-950">{total.toLocaleString('es-MX')}</span>
            <span className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">{totalLabel}</span>
          </div>
        </div>

        <div className="space-y-4">
          {segments.map((segment) => {
            const percentage = total > 0 ? Math.round((segment.value / total) * 100) : 0;
            return (
              <div key={segment.label}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span className="truncate">{segment.label}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-slate-950">
                    {segment.value.toLocaleString('es-MX')} <span className="font-normal text-slate-400">({percentage}%)</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ backgroundColor: segment.color, width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
