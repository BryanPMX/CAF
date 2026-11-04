import dayjs, { type Dayjs } from 'dayjs';

export type ScheduleKind = 'client' | 'internal';
export const SCHEDULE_LABELS: Record<ScheduleKind, string> = {
  client: 'Lunes a Viernes · 09:00–18:00 | Sábado · 08:00–15:00',
  internal: 'Lunes a Viernes · 07:00–20:00 | Sábado · 08:00–15:00',
};

export function schedulingHours(date: Dayjs, kind: ScheduleKind): { open: number; close: number } | null {
  if (date.day() === 0) return null;
  if (date.day() === 6) return { open: 8, close: 15 };
  return kind === 'client' ? { open: 9, close: 18 } : { open: 7, close: 20 };
}

export function withinSchedulingHours(start: Dayjs, end: Dayjs, kind: ScheduleKind): boolean {
  const hours = schedulingHours(start, kind);
  return !!hours && start.isValid() && end.isValid() && end.isAfter(start) && start.isSame(end, 'day') &&
    !start.isBefore(start.startOf('day').hour(hours.open)) && !end.isAfter(start.startOf('day').hour(hours.close));
}

/** Next full hour-long internal meeting inside the permitted schedule. */
export function defaultInternalRange(date: Dayjs, now = dayjs()): [Dayjs, Dayjs] {
  let start = date.isBefore(now, 'day') ? now.startOf('day') : date.startOf('day');
  for (;;) {
    const hours = schedulingHours(start, 'internal');
    if (hours) {
      let candidate = start.hour(hours.open);
      if (!candidate.isAfter(now)) candidate = now.add(1, 'hour').startOf('hour');
      const end = candidate.add(1, 'hour');
      if (candidate.isSame(start, 'day') && withinSchedulingHours(candidate, end, 'internal')) return [candidate, end];
    }
    start = start.add(1, 'day').startOf('day');
  }
}
