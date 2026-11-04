import { apiClient } from '@/app/lib/api';
import type {
  CalendarEventPayload,
  CalendarResponseStatus,
  CalendarStaffMember,
  EmployeeCalendarEvent,
} from '@/app/lib/calendar';

interface ListResponse<T> {
  data?: T[];
}

export const CalendarService = {
  async listEvents(dateFrom: string, dateTo: string): Promise<EmployeeCalendarEvent[]> {
    const response = await apiClient.get<ListResponse<EmployeeCalendarEvent>>('/calendar/events', {
      params: { dateFrom, dateTo },
    });
    return Array.isArray(response.data?.data) ? response.data.data : [];
  },

  async listStaff(): Promise<CalendarStaffMember[]> {
    const response = await apiClient.get<ListResponse<CalendarStaffMember>>('/calendar/staff');
    return Array.isArray(response.data?.data) ? response.data.data : [];
  },

  async createEvent(payload: CalendarEventPayload): Promise<EmployeeCalendarEvent> {
    const response = await apiClient.post<EmployeeCalendarEvent>('/calendar/events', payload);
    return response.data;
  },

  async updateEvent(eventId: number, payload: Partial<CalendarEventPayload>): Promise<EmployeeCalendarEvent> {
    const response = await apiClient.patch<EmployeeCalendarEvent>(`/calendar/events/${eventId}`, payload);
    return response.data;
  },

  async respond(eventId: number, responseStatus: CalendarResponseStatus): Promise<void> {
    await apiClient.patch(`/calendar/events/${eventId}/response`, { responseStatus });
  },

  async removeEvent(eventId: number): Promise<void> {
    await apiClient.delete(`/calendar/events/${eventId}`);
  },
};
