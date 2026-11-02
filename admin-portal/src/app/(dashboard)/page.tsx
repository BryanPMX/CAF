'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Empty, Select, Skeleton } from 'antd';
import {
  BankOutlined,
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  RightOutlined,
  ScheduleOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import DashboardMetricCard, { type DashboardAccent } from './components/DashboardMetricCard';
import NotificationCard from './components/NotificationCard';
import OperationalAlerts, { type OperationalAlertItem } from './components/OperationalAlerts';
import StatusDistributionChart, { type ChartSegment } from './components/StatusDistributionChart';
import { formatSyncTime, resolveNotificationHref } from './components/notificationPresentation';
import { isDashboardStaffRole, useDashboardSummary } from './components/useDashboardSummary';

interface MetricDefinition {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  accent: DashboardAccent;
  href?: string;
}

interface CapacityIndicator {
  label: string;
  value: number;
  helper: string;
}

function formatUpdatedAt(timestamp: number | null): string {
  if (!timestamp) return 'Pendiente de sincronizar';
  return new Date(timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSegments(total: number, first: ChartSegment, second?: ChartSegment): ChartSegment[] {
  const known = first.value + (second?.value || 0);
  const other = Math.max(0, total - known);
  const segments = [first];
  if (second) segments.push(second);
  if (other > 0 || total === 0) {
    segments.push({ label: 'Otros estados', value: other, color: '#cbd5e1' });
  }
  return segments;
}

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useHydrationSafe();
  const { user } = useAuth();
  const role = user?.role;
  const isStaff = isDashboardStaffRole(role);
  const isAdmin = role === 'admin';
  const isManager = role === 'office_manager';

  const {
    summary,
    offices,
    selectedOfficeId,
    selectOffice,
    isLoading,
    isRefreshing,
    error: dashboardError,
    lastUpdatedAt: dashboardUpdatedAt,
    refresh,
  } = useDashboardSummary({
    enabled: hydrated && Boolean(role),
    role,
    userOfficeId: user?.officeId,
  });

  const {
    notifications,
    unreadCount,
    isRefreshing: notificationsRefreshing,
    error: notificationError,
    wsConnected,
    lastUpdatedAt: notificationsUpdatedAt,
    markAsRead,
    refreshNotifications,
  } = useNotifications();

  const metrics = useMemo<MetricDefinition[]>(() => {
    if (!summary) return [];

    if (isStaff) {
      return [
        {
          title: 'Casos abiertos',
          value: summary.myOpenCases,
          description: `de ${summary.myCases} casos asignados`,
          icon: <FolderOpenOutlined />,
          accent: 'blue',
          href: '/app/cases',
        },
        {
          title: 'Citas pendientes',
          value: summary.myPendingAppointments,
          description: `de ${summary.myAppointments} citas asignadas`,
          icon: <ClockCircleOutlined />,
          accent: 'amber',
          href: '/app/appointments',
        },
        {
          title: 'Agenda de hoy',
          value: summary.myAppointmentsToday,
          description: 'citas programadas para hoy',
          icon: <CalendarOutlined />,
          accent: 'cyan',
          href: '/app/appointments',
        },
        {
          title: 'Tareas pendientes',
          value: summary.myPendingTasks,
          description: 'acciones asignadas por completar',
          icon: <ScheduleOutlined />,
          accent: 'rose',
          href: '/app/cases',
        },
      ];
    }

    return [
      {
        title: 'Casos activos',
        value: summary.openCases,
        description: `de ${summary.totalCases} expedientes vigentes`,
        icon: <FolderOpenOutlined />,
        accent: 'blue',
        href: '/app/cases',
      },
      {
        title: 'Citas pendientes',
        value: summary.pendingAppointments,
        description: `de ${summary.totalAppointments} citas registradas`,
        icon: <ClockCircleOutlined />,
        accent: 'amber',
        href: '/app/appointments',
      },
      {
        title: 'Agenda de hoy',
        value: summary.appointmentsToday,
        description: `${summary.appointmentsThisWeek} citas en la semana`,
        icon: <CalendarOutlined />,
        accent: 'cyan',
        href: '/app/appointments',
      },
      {
        title: 'Tareas pendientes',
        value: summary.pendingTasks,
        description: 'acciones abiertas en expedientes',
        icon: <ScheduleOutlined />,
        accent: 'rose',
        href: '/app/cases',
      },
    ];
  }, [isStaff, summary]);

  const caseSegments = useMemo<ChartSegment[]>(() => {
    if (!summary) return [];
    if (isStaff) {
      return buildSegments(summary.myCases, {
        label: 'Abiertos', value: summary.myOpenCases, color: '#2563eb',
      });
    }
    return buildSegments(
      summary.totalCases,
      { label: 'Activos', value: summary.openCases, color: '#2563eb' },
      { label: 'Completados', value: summary.completedCases, color: '#10b981' }
    );
  }, [isStaff, summary]);

  const appointmentSegments = useMemo<ChartSegment[]>(() => {
    if (!summary) return [];
    if (isStaff) {
      return buildSegments(summary.myAppointments, {
        label: 'Pendientes', value: summary.myPendingAppointments, color: '#f59e0b',
      });
    }
    return buildSegments(
      summary.totalAppointments,
      { label: 'Pendientes', value: summary.pendingAppointments, color: '#f59e0b' },
      { label: 'Completadas', value: summary.completedAppointments, color: '#10b981' }
    );
  }, [isStaff, summary]);

  const alerts = useMemo<OperationalAlertItem[]>(() => {
    if (!summary) return [];
    const items: OperationalAlertItem[] = [];
    const tasks = isStaff ? summary.myPendingTasks : summary.pendingTasks;
    const today = isStaff ? summary.myAppointmentsToday : summary.appointmentsToday;

    if (!wsConnected) {
      items.push({
        id: 'realtime',
        title: 'Sincronizacion en vivo interrumpida',
        description: 'El portal intentara reconectarse automaticamente. Puede actualizar la bandeja manualmente.',
        tone: 'warning',
        href: '/app/notifications',
        actionLabel: 'Abrir notificaciones',
      });
    }
    if (tasks > 0) {
      items.push({
        id: 'tasks',
        title: `${tasks} ${tasks === 1 ? 'tarea pendiente' : 'tareas pendientes'}`,
        description: 'Revise las acciones abiertas para evitar retrasos en los expedientes.',
        tone: tasks >= 10 ? 'critical' : 'warning',
        href: '/app/cases',
        actionLabel: 'Revisar expedientes',
      });
    }
    if (today > 0) {
      items.push({
        id: 'today',
        title: `${today} ${today === 1 ? 'cita programada' : 'citas programadas'} para hoy`,
        description: 'Consulte la agenda y confirme que el equipo tenga la informacion necesaria.',
        tone: 'info',
        href: '/app/appointments',
        actionLabel: 'Ver agenda',
      });
    }
    if (unreadCount > 0) {
      items.push({
        id: 'unread',
        title: `${unreadCount} ${unreadCount === 1 ? 'notificacion sin leer' : 'notificaciones sin leer'}`,
        description: 'Hay actividad reciente que puede requerir seguimiento.',
        tone: unreadCount >= 10 ? 'warning' : 'info',
        href: '/app/notifications',
        actionLabel: 'Abrir centro',
      });
    }
    if (items.length === 0) {
      items.push({
        id: 'clear',
        title: 'Operacion al dia',
        description: 'No hay alertas prioritarias en este momento.',
        tone: 'success',
      });
    }
    return items.slice(0, 4);
  }, [isStaff, summary, unreadCount, wsConnected]);

  const capacityIndicators = useMemo<CapacityIndicator[]>(() => {
    if (!summary) return [];
    if (isStaff) {
      return [
        { label: 'Casos asignados', value: summary.myCases, helper: 'Carga total' },
        { label: 'Casos completados', value: summary.myCompletedCases, helper: 'Durante este mes' },
        { label: 'Citas asignadas', value: summary.myAppointments, helper: 'Carga total' },
        { label: 'Sin leer', value: unreadCount, helper: 'Notificaciones' },
      ];
    }
    return [
      { label: 'Casos nuevos', value: summary.casesThisMonth, helper: 'Durante este mes' },
      { label: 'Casos completados', value: summary.completedCases, helper: 'Acumulado' },
      { label: 'Personal', value: summary.totalStaff, helper: 'Usuarios del equipo' },
      { label: 'Clientes', value: summary.totalClients, helper: 'Usuarios registrados' },
    ];
  }, [isStaff, summary, unreadCount]);

  if (!hydrated || isLoading) {
    return (
      <div className="space-y-5" aria-label="Cargando panel de control">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton.Button key={item} active block style={{ height: 150 }} />)}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton active paragraph={{ rows: 6 }} />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert
        showIcon
        type="error"
        message="No pudimos cargar el panel de control"
        description={dashboardError || 'Verifique su conexion e intente nuevamente.'}
        action={<Button onClick={() => void refresh()}>Reintentar</Button>}
      />
    );
  }

  const recentNotifications = notifications.slice(0, 4);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)] sm:p-8">
        <div aria-hidden className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                Centro de operaciones
              </span>
              <span className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${wsConnected ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/20 bg-amber-400/10 text-amber-100'}`}>
                <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {wsConnected ? 'Datos en vivo' : 'Reconectando'}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Panel de Control</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {isStaff
                ? 'Priorice sus casos, citas y tareas desde una vista operativa unificada.'
                : 'Supervise la operacion, detecte pendientes y acceda rapidamente a los flujos esenciales.'}
            </p>
            <p className="mt-4 text-xs text-slate-400">Indicadores actualizados a las {formatUpdatedAt(dashboardUpdatedAt)}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isAdmin && offices.length > 0 && (
              <Select
                aria-label="Filtrar por oficina"
                value={selectedOfficeId || undefined}
                placeholder="Todas las oficinas"
                allowClear
                onChange={selectOffice}
                options={offices.map((office) => ({ value: String(office.id), label: office.name }))}
                className="min-w-[220px]"
                size="large"
              />
            )}
            {isManager && (
              <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-slate-200">
                <BankOutlined /> Oficina asignada
              </span>
            )}
            <Button
              size="large"
              icon={<ReloadOutlined />}
              loading={isRefreshing}
              onClick={() => void refresh({ background: true })}
              className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20"
            >
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {dashboardError && (
        <Alert showIcon closable type="warning" message="Los indicadores no pudieron actualizarse" description={dashboardError} />
      )}

      <section aria-labelledby="dashboard-summary-title">
        <div className="mb-3">
          <h2 id="dashboard-summary-title" className="text-lg font-semibold text-slate-950">Resumen ejecutivo</h2>
          <p className="mt-1 text-sm text-slate-500">Indicadores que requieren seguimiento inmediato.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <DashboardMetricCard key={metric.title} {...metric} />)}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <StatusDistributionChart
          title={isStaff ? 'Estado de mis casos' : 'Distribucion de casos'}
          description={isStaff ? 'Casos abiertos frente al resto de sus asignaciones.' : 'Vista actual de expedientes activos, completados y otros estados.'}
          totalLabel={isStaff ? 'asignados' : 'casos'}
          segments={caseSegments}
        />
        <StatusDistributionChart
          title={isStaff ? 'Estado de mis citas' : 'Distribucion de citas'}
          description={isStaff ? 'Citas pendientes frente al resto de su agenda asignada.' : 'Vista actual de citas pendientes, completadas y otros estados.'}
          totalLabel="citas"
          segments={appointmentSegments}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Indicadores de capacidad</h2>
            <p className="mt-1 text-sm text-slate-500">Contexto adicional para dimensionar la carga operativa.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {capacityIndicators.map((indicator) => (
              <div key={indicator.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{indicator.label}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-2xl font-semibold text-slate-950">{indicator.value.toLocaleString('es-MX')}</p>
                  <p className="text-right text-xs text-slate-500">{indicator.helper}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Acciones rapidas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/app/cases"><Button icon={<FileAddOutlined />}>Expedientes</Button></Link>
              <Link href="/app/appointments"><Button icon={<CalendarOutlined />}>Agenda</Button></Link>
              {(isAdmin || isManager) && <Link href="/app/users"><Button icon={<UserAddOutlined />}>Usuarios</Button></Link>}
              {isAdmin && <Link href="/app/offices"><Button icon={<BankOutlined />}>Oficinas</Button></Link>}
            </div>
          </div>
        </div>

        <OperationalAlerts alerts={alerts} />
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-xl text-sky-700">
              <BellOutlined />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">Notificaciones esenciales</h2>
                {unreadCount > 0 && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">{unreadCount} sin leer</span>}
              </div>
              <p className="mt-1 text-sm text-slate-500">Actividad reciente de casos, citas y tareas.</p>
              <p className="mt-1 text-xs text-slate-400">Sincronizado: {formatSyncTime(notificationsUpdatedAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<ReloadOutlined />}
              loading={notificationsRefreshing}
              onClick={() => void refreshNotifications().catch(() => undefined)}
            >
              Actualizar
            </Button>
            <Button type="primary" icon={<RightOutlined />} onClick={() => router.push('/app/notifications')}>
              Abrir centro
            </Button>
          </div>
        </div>

        {notificationError && (
          <Alert className="mt-4" showIcon type="warning" message="No pudimos sincronizar las notificaciones" description={notificationError} />
        )}

        <div className="mt-5">
          {recentNotifications.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {recentNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  compact
                  onClick={() => {
                    if (!notification.isRead) void markAsRead(notification.id).catch(() => undefined);
                    const href = resolveNotificationHref(notification);
                    if (href) router.push(href);
                  }}
                  onMarkAsRead={notification.isRead ? undefined : () => void markAsRead(notification.id).catch(() => undefined)}
                />
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay notificaciones recientes" />
          )}
        </div>
      </section>
    </div>
  );
}
