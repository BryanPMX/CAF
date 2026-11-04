'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Calendar, Empty, Select, Spin, Tag } from 'antd';
import { LeftOutlined, RightOutlined, ReloadOutlined } from '@ant-design/icons';
import esES from 'antd/es/calendar/locale/es_ES';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import { availableAppointmentSlots, loadEmployeeAvailability, type AppointmentSlot, type BusyInterval } from '@/services/appointmentAvailability';
import styles from './AppointmentAvailabilityPicker.module.css';

interface Props {
  staffId?: number;
  employeeName?: string;
  value?: AppointmentSlot;
  onChange?: (value?: AppointmentSlot) => void;
}

export default function AppointmentAvailabilityPicker({ staffId, employeeName, value, onChange }: Props) {
  const [date, setDate] = useState(() => (value?.startTime || dayjs()).startOf('day'));
  const [duration, setDuration] = useState(() => value ? value.endTime.diff(value.startTime, 'minute') : 60);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; busy: BusyInterval[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const month = date.format('YYYY-MM');
  const key = `${staffId}:${month}:${revision}`;
  const loading = !!staffId && result?.key !== key && !error;
  const ready = !!staffId && result?.key === key && !error;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let active = true;
    setError(null);
    if (!staffId) return;
    const first = dayjs(`${month}-01`);
    loadEmployeeAvailability(staffId, first.startOf('week'), first.endOf('month').endOf('week').add(1, 'day').startOf('day'))
      .then((busy) => { if (active) setResult({ key, busy }); })
      .catch(() => { if (active) setError('No se pudo consultar la disponibilidad. Intente nuevamente.'); });
    return () => { active = false; };
  }, [staffId, month, key]);

  // Refresh while open so newly booked times disappear without reopening the form.
  useEffect(() => {
    if (!staffId) return;
    const timer = window.setInterval(() => setRevision((previous) => previous + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [staffId]);

  const slots = useMemo(() => ready ? availableAppointmentSlots(date, duration, result?.busy || []) : [], [date, duration, ready, result]);
  const selectedStillAvailable = value && slots.some((slot) => slot.valueOf() === value.startTime.valueOf());

  const changeDate = (next: Dayjs) => { setDate(next); onChange?.(undefined); };

  return (
    <section className={styles.panel} aria-label="Disponibilidad del empleado">
      <div className={styles.heading}>
        <div>
          <h3>{employeeName ? `Agenda de ${employeeName}` : 'Disponibilidad'}</h3>
          <p>Lunes a Viernes · 09:00–18:00</p>
          <p>Zona horaria: {timeZone}</p>
        </div>
        <Select
          aria-label="Duración de la cita"
          value={duration}
          disabled={!staffId}
          onChange={(next) => { setDuration(next); onChange?.(undefined); }}
          options={[30, 60, 90, 120].map((minutes) => ({ value: minutes, label: `${minutes} minutos` }))}
        />
      </div>
      {!staffId ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Seleccione un empleado para consultar su agenda" /> : (
        <>
          {error && <Alert type="error" showIcon message={error} action={<Button onClick={() => { setError(null); setRevision((previous) => previous + 1); }}>Reintentar</Button>} />}
          <div className={styles.content} aria-busy={loading}>
            <div className={styles.calendar}>
              <Calendar
                fullscreen={false}
                locale={esES}
                value={date}
                onSelect={(next, info) => { if (info.source === 'date') changeDate(next); }}
                disabledDate={(day) => !ready || day.isBefore(dayjs(), 'day') || day.day() === 0 || day.day() === 6 || availableAppointmentSlots(day, duration, result?.busy || []).length === 0}
                headerRender={() => (
                  <div className={styles.monthHeader}>
                    <Button type="text" icon={<LeftOutlined />} aria-label="Mes anterior" disabled={date.startOf('month').isBefore(dayjs().startOf('month').add(1, 'month'))} onClick={() => changeDate(date.subtract(1, 'month').startOf('month'))} />
                    <span>{date.locale('es').format('MMMM YYYY')}</span>
                    <Button type="text" icon={<RightOutlined />} aria-label="Mes siguiente" onClick={() => changeDate(date.add(1, 'month').startOf('month'))} />
                  </div>
                )}
              />
            </div>
            <div className={styles.times}>
              <div className={styles.dayHeading}>
                <h4>{date.locale('es').format('dddd D [de] MMMM')}</h4>
                <Button type="text" icon={<ReloadOutlined />} aria-label="Actualizar disponibilidad" loading={loading} onClick={() => { setError(null); setRevision((previous) => previous + 1); }} />
              </div>
              {loading ? <div className={styles.placeholder} role="status" aria-label="Consultando agenda"><Spin /></div> : error ? null : slots.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin horarios disponibles. Seleccione otro día." />
              ) : (
                <div className={styles.slots} role="group" aria-label="Horarios disponibles">
                  {slots.map((slot) => (
                    <Button key={slot.toISOString()} type={value?.startTime.valueOf() === slot.valueOf() ? 'primary' : 'default'} aria-pressed={value?.startTime.valueOf() === slot.valueOf()} onClick={() => onChange?.({ startTime: slot, endTime: slot.add(duration, 'minute'), timeZone })}>
                      {slot.format('HH:mm')}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {value && ready && !selectedStillAvailable && <Alert type="warning" showIcon message="El horario seleccionado ya no está disponible. Seleccione otro." />}
          {value && selectedStillAvailable && <div className={styles.selection}><Tag color="blue">Horario seleccionado</Tag>{value.startTime.format('DD/MM/YYYY · HH:mm')}–{value.endTime.format('HH:mm')}</div>}
        </>
      )}
    </section>
  );
}
