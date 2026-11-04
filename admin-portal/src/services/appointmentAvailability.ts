import dayjs, { type Dayjs } from 'dayjs';
import { apiClient } from '@/app/lib/api';
import { schedulingHours } from '@/app/lib/schedulingHours';

export interface BusyInterval { startTime: string; endTime: string; }
export interface AppointmentSlot { startTime: Dayjs; endTime: Dayjs; timeZone: string; }

export async function loadEmployeeAvailability(staffId: number, from: Dayjs, to: Dayjs): Promise<BusyInterval[]> {
  const response = await apiClient.get<{ busy: BusyInterval[] }>('/appointment-availability', {
    params: { staffId, from: from.toISOString(), to: to.toISOString() },
  });
  if (!Array.isArray(response.data.busy)) throw new Error('Respuesta de disponibilidad inválida');
  return response.data.busy;
}

/** Half-open intervals allow back-to-back appointments, including across time zones. */
export function availableAppointmentSlots(date: Dayjs, duration: number, busy: BusyInterval[], now = dayjs()): Dayjs[] {
  const hours = schedulingHours(date, 'client');
  if (!hours || ![30, 60, 90, 120].includes(duration)) return [];
  const close = date.startOf('day').hour(hours.close);
  const slots: Dayjs[] = [];
  for (let start = date.startOf('day').hour(hours.open); !start.add(duration, 'minute').isAfter(close); start = start.add(30, 'minute')) {
    const end = start.add(duration, 'minute');
    if (start.isAfter(now) && !busy.some((interval) => start.isBefore(dayjs(interval.endTime)) && end.isAfter(dayjs(interval.startTime)))) {
      slots.push(start);
    }
  }
  return slots;
}
