import type { OrganizationMembership } from './organizations';
export interface ProfileOffice {
  id: number;
  name?: string;
}

// Fields shared by /profile, /client/profile and the user in /admin/users/:id.
export interface UserProfile {
  organizationMemberships?: OrganizationMembership[];
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string | null;
  officeId?: number | null;
  office?: ProfileOffice | null;
  department?: string | null;
  specialty?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  lastLogin?: string | null;
}

export interface AvatarPolicy {
  maxBytes: number;
  maxURLBytes: number;
  allowedMimeTypes: string[];
}

export interface OwnProfile extends UserProfile {
  userID: string | number;
  avatarUrl: string;
  avatarPolicy?: AvatarPolicy;
}

export function getProfileName(profile: Pick<UserProfile, 'firstName' | 'lastName'>): string {
  return [profile.firstName, profile.lastName].map(name => name.trim()).filter(Boolean).join(' ');
}

export function getProfileInitials(profile: Pick<UserProfile, 'firstName' | 'lastName'>): string {
  return [profile.firstName, profile.lastName].map(name => Array.from(name.trim())[0] || '').join('').toLocaleUpperCase('es-MX');
}

export function formatProfileDate(value?: string | null, includeTime = false): string | null {
  if (!value || value.startsWith('0001-')) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  }).format(date);
}

export function isValidProfilePhotoURL(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}
