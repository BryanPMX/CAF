'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Avatar,
  Button,
  Calendar,
  Empty,
  Grid,
  Popconfirm,
  Select,
  Spin,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import { apiClient } from '@/app/lib/api';
import type { Appointment } from '@/app/lib/types';
import type {
  CalendarResponseStatus,
  CalendarStaffMember,
  EmployeeCalendarEvent,
} from '@/app/lib/calendar';
import { useAuth } from '@/context/AuthContext';
import { CalendarService } from '@/services/calendarService';
import CalendarEventModal from './components/CalendarEventModal';

interface CalendarAppointment extends Appointment {
  case?: {
    id: number;
    title: string;
    client?: { id: number; firstName: string; lastName: string };
  };
}

interface AppointmentListResponse {
  data?: CalendarAppointment[];
}

type CalendarFilter = 'all' | 'internal' | 'appointment';
type CalendarItem =
  | { key: string; kind: 'internal'; startTime: string; endTime: string; title: string; event: EmployeeCalendarEvent }
  | { key: string; kind: 'appointment'; startTime: string; endTime: string; title: string; appointment: CalendarAppointment };

const RESPONSE_META: Record<CalendarResponseStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'gold' },
  accepted: { label: 'Aceptada', color: 'green' },
  tentative: { label: 'Tentativa', color: 'blue' },
  declined: { label: 'Rechazada', color: 'red' },
};

function capitalize(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase('es-MX') + value.slice(1) : value;
}

function getClientName(appointment: CalendarAppointment): string {
  const client = appointment.case?.client;
  return client ? `${client.firstName} ${client.lastName}`.trim() : 'Cliente no disponible';
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getApiError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return fallback;
}

export default function EmployeeCalendarPage() {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const { user } = useAuth();
  const [calendarValue, setCalendarValue] = useState<Dayjs>(() => dayjs());
  const [events, setEvents] = useState<EmployeeCalendarEvent[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [staff, setStaff] = useState<CalendarStaffMember[]>([]);
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EmployeeCalendarEvent | null>(null);

  const monthKey = calendarValue.format('YYYY-MM');

  const loadCalendar = useCallback(async (background = false) => {
    if (!user?.id) return;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const month = dayjs(`${monthKey}-01`);
    const dateFrom = month.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
    const dateTo = month.endOf('month').add(7, 'day').format('YYYY-MM-DD');
    const [eventsResult, appointmentsResult] = await Promise.allSettled([
      CalendarService.listEvents(dateFrom, dateTo),
      apiClient.get<AppointmentListResponse>('/appointments/my', { params: { dateFrom, dateTo, pageSize: 200 } }),
    ]);

    if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
    if (appointmentsResult.status === 'fulfilled') {
      const payload = appointmentsResult.value.data?.data;
      setAppointments(Array.isArray(payload) ? payload : []);
    }
    const failed = [eventsResult, appointmentsResult].filter((result) => result.status === 'rejected').length;
    if (failed > 0) setError('Algunos datos del calendario no pudieron actualizarse.');
    setLoading(false);
    setRefreshing(false);
  }, [monthKey, user?.id]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    CalendarService.listStaff()
      .then((members) => {
        if (active) setStaff(members);
      })
      .catch(() => {
        if (active) setError('No fue posible cargar el directorio de personal.');
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const internalItems: CalendarItem[] = events.map((event) => ({
      key: `internal-${event.id}`, kind: 'internal', title: event.title,
      startTime: event.startTime, endTime: event.endTime, event,
    }));
    const appointmentItems: CalendarItem[] = appointments.map((appointment) => ({
      key: `appointment-${appointment.id}`, kind: 'appointment', title: appointment.title,
      startTime: appointment.startTime, endTime: appointment.endTime, appointment,
    }));
    if (filter === 'internal') return internalItems;
    if (filter === 'appointment') return appointmentItems;
    return [...internalItems, ...appointmentItems];
  }, [appointments, events, filter]);

  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarItem[]>();
    calendarItems.forEach((item) => {
      const key = dayjs(item.startTime).format('YYYY-MM-DD');
      grouped.set(key, [...(grouped.get(key) || []), item].sort((a, b) =>
        dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
      ));
    });
    return grouped;
  }, [calendarItems]);

  const selectedItems = itemsByDate.get(calendarValue.format('YYYY-MM-DD')) || [];
  const todayItems = itemsByDate.get(dayjs().format('YYYY-MM-DD')) || [];
  const pendingResponses = events.filter((event) =>
    event.attendees.some((attendee) => attendee.userId === user?.id && attendee.responseStatus === 'pending')
  ).length;

  const openCreateModal = () => {
    setEditingEvent(null);
    setEventModalOpen(true);
  };

  const handleSaved = (saved: EmployeeCalendarEvent) => {
    setEvents((current) => {
      const exists = current.some((event) => event.id === saved.id);
      return exists ? current.map((event) => event.id === saved.id ? saved : event) : [...current, saved];
    });
    setCalendarValue(dayjs(saved.startTime));
    setEventModalOpen(false);
    setEditingEvent(null);
  };

  const handleResponse = async (event: EmployeeCalendarEvent, responseStatus: CalendarResponseStatus) => {
    try {
      await CalendarService.respond(event.id, responseStatus);
      setEvents((current) => current.map((item) => item.id !== event.id ? item : {
        ...item,
        attendees: item.attendees.map((attendee) =>
          attendee.userId === user?.id ? { ...attendee, responseStatus } : attendee
        ),
      }));
      message.success('Respuesta actualizada.');
    } catch (responseError) {
      message.error(getApiError(responseError, 'No fue posible actualizar la respuesta.'));
    }
  };

  const handleDelete = async (event: EmployeeCalendarEvent) => {
    try {
      await CalendarService.removeEvent(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      message.success('Evento cancelado.');
    } catch (deleteError) {
      message.error(getApiError(deleteError, 'No fue posible cancelar el evento.'));
    }
  };

  const renderCalendarCell = (date: Dayjs, info: { type: string }) => {
    if (info.type !== 'date') return null;
    const items = itemsByDate.get(date.format('YYYY-MM-DD')) || [];
    if (items.length === 0) return null;

    if (!screens.md) {
      return (
        <div className="mt-1 flex justify-center gap-1" aria-label={`${items.length} eventos`}>
          {items.slice(0, 3).map((item) => (
            <span key={item.key} className={`h-1.5 w-1.5 rounded-full ${item.kind === 'internal' ? 'bg-violet-500' : 'bg-cyan-500'}`} />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1 pt-1">
        {items.slice(0, 2).map((item) => (
          <Tooltip key={item.key} title={`${item.title} · ${dayjs(item.startTime).format('HH:mm')}`}>
            <button
              type="button"
              className={`block w-full truncate rounded-md border px-2 py-1 text-left text-[11px] font-medium transition hover:brightness-95 ${
                item.kind === 'internal'
                  ? 'border-violet-200 bg-violet-50 text-violet-800'
                  : 'border-cyan-200 bg-cyan-50 text-cyan-800'
              }`}
              onClick={(event) => { event.stopPropagation(); setCalendarValue(date); }}
            >
              {dayjs(item.startTime).format('HH:mm')} · {item.title}
            </button>
          </Tooltip>
        ))}
        {items.length > 2 && <p className="px-1 text-[10px] font-medium text-slate-500">+{items.length - 2} más</p>}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)] sm:p-8">
        <div aria-hidden className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              <CalendarOutlined className="text-cyan-300" />
              <span>Calendario</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Reuniones internas y citas con clientes en una sola agenda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void loadCalendar(true)}>Actualizar</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Nuevo evento</Button>
          </div>
        </div>
      </section>

      {error && (
        <Alert showIcon type="warning" message={error} action={<Button size="small" onClick={() => void loadCalendar(true)}>Reintentar</Button>} />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del calendario">
        {[
          { label: 'Hoy', value: todayItems.length, helper: 'eventos programados', icon: <CalendarOutlined />, color: 'text-cyan-700 bg-cyan-50' },
          { label: 'Reuniones internas', value: events.length, helper: 'en el periodo visible', icon: <TeamOutlined />, color: 'text-violet-700 bg-violet-50' },
          { label: 'Citas con clientes', value: appointments.length, helper: 'asignadas a usted', icon: <ClockCircleOutlined />, color: 'text-blue-700 bg-blue-50' },
          { label: 'Por responder', value: pendingResponses, helper: 'invitaciones pendientes', icon: <CheckOutlined />, color: 'text-amber-700 bg-amber-50' },
        ].map((metric) => (
          <div key={metric.label} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{metric.value}</p>
                <p className="mt-1 text-sm text-slate-500">{metric.helper}</p>
              </div>
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${metric.color}`}>{metric.icon}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.5fr)]">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Agenda compartida</h2>
              <p className="mt-1 text-sm text-slate-500">Seleccione un día para ver sus compromisos.</p>
            </div>
            <Select<CalendarFilter>
              aria-label="Filtrar calendario"
              value={filter}
              onChange={setFilter}
              className="w-full sm:w-52"
              options={[
                { value: 'all', label: 'Toda la agenda' },
                { value: 'internal', label: 'Reuniones internas' },
                { value: 'appointment', label: 'Citas con clientes' },
              ]}
            />
          </div>

          <Spin spinning={loading}>
            <Calendar
              className="staff-calendar"
              fullscreen={Boolean(screens.md)}
              value={calendarValue}
              onChange={setCalendarValue}
              cellRender={renderCalendarCell}
              headerRender={({ value, onChange }) => (
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                  <Button aria-label="Mes anterior" icon={<LeftOutlined />} onClick={() => onChange(value.subtract(1, 'month'))} />
                  <div className="flex items-center gap-2">
                    <Button size="small" onClick={() => onChange(dayjs())}>Hoy</Button>
                    <p className="min-w-32 text-center text-sm font-semibold capitalize text-slate-800">{value.locale('es').format('MMMM YYYY')}</p>
                  </div>
                  <Button aria-label="Mes siguiente" icon={<RightOutlined />} onClick={() => onChange(value.add(1, 'month'))} />
                </div>
              )}
            />
          </Spin>
        </div>

        <aside className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Agenda del día</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{capitalize(calendarValue.locale('es').format('dddd D [de] MMMM'))}</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{selectedItems.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {selectedItems.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay eventos para este día" />
            ) : selectedItems.map((item) => {
              if (item.kind === 'appointment') {
                return (
                  <button
                    type="button"
                    key={item.key}
                    className="w-full rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-left transition hover:border-cyan-300"
                    onClick={() => router.push('/app/appointments')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{getClientName(item.appointment)}</p>
                      </div>
                      <Tag color="cyan" className="!mr-0">Cita</Tag>
                    </div>
                    <p className="mt-3 text-xs font-medium text-slate-600"><ClockCircleOutlined className="mr-2 text-cyan-700" />{dayjs(item.startTime).format('HH:mm')}–{dayjs(item.endTime).format('HH:mm')}</p>
                  </button>
                );
              }

              const response = item.event.attendees.find((attendee) => attendee.userId === user?.id)?.responseStatus || 'pending';
              const isOrganizer = item.event.organizerId === user?.id;
              return (
                <div key={item.key} className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">Organiza {item.event.organizer.firstName} {item.event.organizer.lastName}</p>
                    </div>
                    <Tag color={RESPONSE_META[response].color} className="!mr-0">{isOrganizer ? 'Organiza' : RESPONSE_META[response].label}</Tag>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-600"><ClockCircleOutlined className="mr-2 text-violet-700" />{dayjs(item.startTime).format('HH:mm')}–{dayjs(item.endTime).format('HH:mm')}</p>
                  {item.event.location && <p className="mt-2 text-xs text-slate-500"><EnvironmentOutlined className="mr-2" />{item.event.location}</p>}
                  {item.event.description && <p className="mt-2 text-xs leading-5 text-slate-600">{item.event.description}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Avatar.Group max={{ count: 4 }} size="small">
                      {item.event.attendees.map((attendee) => (
                        <Tooltip key={attendee.id} title={`${attendee.user.firstName} ${attendee.user.lastName} · ${RESPONSE_META[attendee.responseStatus].label}`}>
                          <Avatar className="bg-violet-600">{getInitials(attendee.user.firstName, attendee.user.lastName)}</Avatar>
                        </Tooltip>
                      ))}
                    </Avatar.Group>
                    {isOrganizer && (
                      <div className="flex gap-1">
                        <Button size="small" type="text" aria-label={`Editar ${item.title}`} icon={<EditOutlined />} onClick={() => { setEditingEvent(item.event); setEventModalOpen(true); }} />
                        <Popconfirm
                          title="Cancelar evento"
                          description="Se notificará a los participantes."
                          okText="Cancelar evento"
                          cancelText="Conservar"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => void handleDelete(item.event)}
                        >
                          <Button danger size="small" type="text" aria-label={`Cancelar ${item.title}`} icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                  {!isOrganizer && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <Button size="small" type={response === 'accepted' ? 'primary' : 'default'} onClick={() => void handleResponse(item.event, 'accepted')}>Aceptar</Button>
                      <Button size="small" type={response === 'tentative' ? 'primary' : 'default'} onClick={() => void handleResponse(item.event, 'tentative')}>Tal vez</Button>
                      <Button size="small" danger type={response === 'declined' ? 'primary' : 'default'} onClick={() => void handleResponse(item.event, 'declined')}>Rechazar</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button block type="primary" className="mt-5" icon={<PlusOutlined />} onClick={openCreateModal}>Nuevo evento en este día</Button>
        </aside>
      </section>

      {user?.id && (
        <CalendarEventModal
          open={eventModalOpen}
          event={editingEvent}
          staff={staff}
          currentUserId={user.id}
          initialDate={calendarValue}
          onCancel={() => { setEventModalOpen(false); setEditingEvent(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
