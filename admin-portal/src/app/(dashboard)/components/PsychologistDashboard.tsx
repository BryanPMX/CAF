'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Calendar,
  Empty,
  Grid,
  Select,
  Spin,
  Tag,
  Tooltip,
} from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import { apiClient } from '@/app/lib/api';
import type { Appointment } from '@/app/lib/types';
import {
  APPOINTMENT_STATUS_CONFIG,
  APPOINTMENT_STATUS_OPTIONS,
} from '@/config/statuses';
import type { DashboardSummary } from './useDashboardSummary';
import DashboardMetricCard from './DashboardMetricCard';

interface PsychologistAppointment extends Appointment {
  case?: {
    id: number;
    title: string;
    client?: {
      id: number;
      firstName: string;
      lastName: string;
    };
  };
}

interface AppointmentListResponse {
  data?: PsychologistAppointment[];
}

interface PsychologistDashboardProps {
  summary: DashboardSummary;
  summaryError: string | null;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
  unreadCount: number;
  onRefreshSummary: () => Promise<void>;
}

const STATUS_STYLES: Record<string, { dot: string; chip: string }> = {
  pending: { dot: 'bg-amber-500', chip: 'border-amber-200 bg-amber-50 text-amber-800' },
  confirmed: { dot: 'bg-blue-500', chip: 'border-blue-200 bg-blue-50 text-blue-800' },
  completed: { dot: 'bg-emerald-500', chip: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  cancelled: { dot: 'bg-slate-400', chip: 'border-slate-200 bg-slate-50 text-slate-600' },
  no_show: { dot: 'bg-rose-500', chip: 'border-rose-200 bg-rose-50 text-rose-800' },
};

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase('es-MX') + value.slice(1);
}

function formatUpdatedAt(timestamp: number | null): string {
  if (!timestamp) return 'Pendiente';
  return new Date(timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getClientName(appointment: PsychologistAppointment): string {
  const client = appointment.case?.client;
  if (!client) return 'Cliente no disponible';
  return `${client.firstName} ${client.lastName}`.trim();
}

export default function PsychologistDashboard({
  summary,
  summaryError,
  isRefreshing,
  lastUpdatedAt,
  unreadCount,
  onRefreshSummary,
}: PsychologistDashboardProps) {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const [calendarValue, setCalendarValue] = useState<Dayjs>(() => dayjs());
  const [appointments, setAppointments] = useState<PsychologistAppointment[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isRefreshingAppointments, setIsRefreshingAppointments] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);

  const monthKey = calendarValue.format('YYYY-MM');

  const loadAppointments = useCallback(async (background = false) => {
    if (background) setIsRefreshingAppointments(true);
    else setIsLoadingAppointments(true);
    setAppointmentsError(null);

    const month = dayjs(`${monthKey}-01`);
    try {
      const response = await apiClient.get<AppointmentListResponse>('/appointments/my', {
        params: {
          dateFrom: month.startOf('month').subtract(7, 'day').format('YYYY-MM-DD'),
          dateTo: month.endOf('month').add(7, 'day').format('YYYY-MM-DD'),
          pageSize: 200,
        },
      });
      setAppointments(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch {
      setAppointmentsError('No fue posible cargar la agenda. Intente nuevamente.');
    } finally {
      setIsLoadingAppointments(false);
      setIsRefreshingAppointments(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    return appointments.filter((appointment) => appointment.status === statusFilter);
  }, [appointments, statusFilter]);

  const appointmentsByDate = useMemo(() => {
    const grouped = new Map<string, PsychologistAppointment[]>();
    filteredAppointments.forEach((appointment) => {
      const key = dayjs(appointment.startTime).format('YYYY-MM-DD');
      const items = grouped.get(key) || [];
      grouped.set(key, [...items, appointment].sort((left, right) =>
        dayjs(left.startTime).valueOf() - dayjs(right.startTime).valueOf()
      ));
    });
    return grouped;
  }, [filteredAppointments]);

  const selectedAppointments = appointmentsByDate.get(calendarValue.format('YYYY-MM-DD')) || [];
  const todayAppointments = appointments.filter((appointment) =>
    dayjs(appointment.startTime).isSame(dayjs(), 'day')
  );

  const handleRefresh = async () => {
    await Promise.allSettled([
      loadAppointments(true),
      onRefreshSummary(),
    ]);
  };

  const renderCalendarCell = (date: Dayjs, info: { type: string }) => {
    if (info.type !== 'date') return null;
    const dayAppointments = appointmentsByDate.get(date.format('YYYY-MM-DD')) || [];
    if (dayAppointments.length === 0) return null;

    if (!screens.md) {
      return (
        <div className="mt-1 flex justify-center gap-1" aria-label={`${dayAppointments.length} citas`}>
          {dayAppointments.slice(0, 3).map((appointment) => (
            <span
              key={appointment.id}
              className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[appointment.status]?.dot || 'bg-blue-500'}`}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1 pt-1">
        {dayAppointments.slice(0, 2).map((appointment) => {
          const style = STATUS_STYLES[appointment.status] || STATUS_STYLES.confirmed;
          return (
            <Tooltip key={appointment.id} title={`${appointment.title} · ${getClientName(appointment)}`}>
              <button
                type="button"
                className={`block w-full truncate rounded-md border px-2 py-1 text-left text-[11px] font-medium transition hover:brightness-95 ${style.chip}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setCalendarValue(date);
                }}
              >
                {dayjs(appointment.startTime).format('HH:mm')} · {appointment.title}
              </button>
            </Tooltip>
          );
        })}
        {dayAppointments.length > 2 && (
          <p className="px-1 text-[10px] font-medium text-slate-500">+{dayAppointments.length - 2} más</p>
        )}
      </div>
    );
  };

  const selectedDateLabel = capitalize(calendarValue.locale('es').format('dddd D [de] MMMM'));
  const todayLabel = capitalize(dayjs().locale('es').format('dddd D [de] MMMM [de] YYYY'));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950 p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)] sm:p-8">
        <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              <CalendarOutlined className="text-cyan-300" />
              <span>Agenda de Psicología</span>
            </h1>
            <p className="mt-3 text-sm text-slate-300">{todayLabel}</p>
            <p className="mt-1 text-xs text-slate-400">Actualizado: {formatUpdatedAt(lastUpdatedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<ReloadOutlined />}
              loading={isRefreshing || isRefreshingAppointments}
              onClick={() => void handleRefresh()}
            >
              Actualizar
            </Button>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => router.push('/app/appointments')}>
              Ver todas las citas
            </Button>
          </div>
        </div>
      </section>

      {(summaryError || appointmentsError) && (
        <Alert
          showIcon
          type="warning"
          message="Algunos datos no pudieron actualizarse"
          description={appointmentsError || summaryError}
          action={<Button size="small" onClick={() => void handleRefresh()}>Reintentar</Button>}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen personal">
        <DashboardMetricCard
          title="Citas hoy"
          value={todayAppointments.length}
          description="Agenda del día"
          icon={<CalendarOutlined />}
          accent="cyan"
          href="/app/appointments"
        />
        <DashboardMetricCard
          title="Citas pendientes"
          value={summary.myPendingAppointments}
          description={`de ${summary.myAppointments} citas asignadas`}
          icon={<ClockCircleOutlined />}
          accent="amber"
          href="/app/appointments"
        />
        <DashboardMetricCard
          title="Casos abiertos"
          value={summary.myOpenCases}
          description={`de ${summary.myCases} casos asignados`}
          icon={<FolderOpenOutlined />}
          accent="blue"
          href="/app/cases"
        />
        <DashboardMetricCard
          title="Notificaciones"
          value={unreadCount}
          description="Sin leer"
          icon={<BellOutlined />}
          accent="violet"
          href="/app/notifications"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Calendario</h2>
              <p className="mt-1 text-sm text-slate-500">Seleccione un día para consultar su agenda.</p>
            </div>
            <Select
              aria-label="Filtrar citas por estado"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-full sm:w-48"
              options={[
                { value: 'all', label: 'Todos los estados' },
                ...APPOINTMENT_STATUS_OPTIONS,
              ]}
            />
          </div>

          <Spin spinning={isLoadingAppointments}>
            <Calendar
              className="psychologist-calendar"
              fullscreen={Boolean(screens.md)}
              value={calendarValue}
              onChange={setCalendarValue}
              cellRender={renderCalendarCell}
              headerRender={({ value, onChange }) => (
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                  <Button
                    aria-label="Mes anterior"
                    icon={<LeftOutlined />}
                    onClick={() => onChange(value.subtract(1, 'month'))}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="small" onClick={() => onChange(dayjs())}>Hoy</Button>
                    <p className="min-w-32 text-center text-sm font-semibold capitalize text-slate-800">
                      {value.locale('es').format('MMMM YYYY')}
                    </p>
                  </div>
                  <Button
                    aria-label="Mes siguiente"
                    icon={<RightOutlined />}
                    onClick={() => onChange(value.add(1, 'month'))}
                  />
                </div>
              )}
            />
          </Spin>
        </div>

        <aside className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Agenda del día</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedDateLabel}</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {selectedAppointments.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {selectedAppointments.length > 0 ? selectedAppointments.map((appointment) => {
              const status = APPOINTMENT_STATUS_CONFIG[appointment.status];
              return (
                <button
                  type="button"
                  key={appointment.id}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
                  onClick={() => router.push('/app/appointments')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{appointment.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{getClientName(appointment)}</p>
                    </div>
                    <Tag color={status?.color || 'default'} className="!mr-0">
                      {status?.label || appointment.status}
                    </Tag>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600">
                    <ClockCircleOutlined className="text-blue-600" />
                    {dayjs(appointment.startTime).format('HH:mm')}–{dayjs(appointment.endTime).format('HH:mm')}
                  </div>
                  {appointment.case?.title && (
                    <p className="mt-2 truncate text-xs text-slate-500">Expediente: {appointment.case.title}</p>
                  )}
                </button>
              );
            }) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay citas para este día" />
            )}
          </div>

          <Button
            block
            className="mt-5"
            type="primary"
            icon={<RightOutlined />}
            onClick={() => router.push('/app/appointments')}
          >
            Gestionar agenda
          </Button>
        </aside>
      </section>
    </div>
  );
}
