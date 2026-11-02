'use client';

import Link from 'next/link';
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  InfoCircleFilled,
  WarningFilled,
} from '@ant-design/icons';

export type OperationalAlertTone = 'success' | 'info' | 'warning' | 'critical';

export interface OperationalAlertItem {
  id: string;
  title: string;
  description: string;
  tone: OperationalAlertTone;
  href?: string;
  actionLabel?: string;
}

interface OperationalAlertsProps {
  alerts: OperationalAlertItem[];
}

const TONE_META: Record<OperationalAlertTone, { icon: React.ReactNode; classes: string }> = {
  success: { icon: <CheckCircleFilled />, classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-800' },
  info: { icon: <InfoCircleFilled />, classes: 'border-sky-200 bg-sky-50/80 text-sky-800' },
  warning: { icon: <WarningFilled />, classes: 'border-amber-200 bg-amber-50/80 text-amber-900' },
  critical: { icon: <ExclamationCircleFilled />, classes: 'border-rose-200 bg-rose-50/80 text-rose-900' },
};

export default function OperationalAlerts({ alerts }: OperationalAlertsProps) {
  return (
    <section className="h-full rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Prioridades operativas</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {alerts.length}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.map((alert) => {
          const tone = TONE_META[alert.tone];
          const body = (
            <div className={`group flex items-start gap-3 rounded-2xl border p-4 ${tone.classes}`}>
              <span className="mt-0.5 text-base">{tone.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{alert.title}</p>
                <p className="mt-1 text-sm leading-5 opacity-80">{alert.description}</p>
                {alert.href && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                    {alert.actionLabel || 'Revisar'} <ArrowRightOutlined />
                  </p>
                )}
              </div>
            </div>
          );

          return alert.href ? <Link key={alert.id} href={alert.href}>{body}</Link> : <div key={alert.id}>{body}</div>;
        })}
      </div>
    </section>
  );
}
