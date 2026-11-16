import type { ClientOption } from './organizations';
import type { UserRole } from './types';

export type CalendarResponseStatus = 'pending' | 'accepted' | 'tentative' | 'declined';

export interface CalendarStaffMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  officeId?: number;
  officeName?: string;
}

export interface CalendarEventAttendee {
  id: number;
  eventId: number;
  userId: number;
  responseStatus: CalendarResponseStatus;
  user: CalendarStaffMember;
}

export interface EmployeeCalendarEvent {
  relatedClients?: { id:number; clientId:number; client?:ClientOption }[];
  id: number;
  organizerId: number;
  organizer: CalendarStaffMember;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  attendees: CalendarEventAttendee[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventPayload {
  relatedClientIds?: number[];
  timeZone?: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  attendeeIds: number[];
}
