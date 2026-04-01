'use client';

import React from 'react';
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  FileTextOutlined,
  FolderOpenOutlined,
  InfoCircleFilled,
  MailOutlined,
  WarningFilled,
} from '@ant-design/icons';
import type { Notification } from '@/context/NotificationContext';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

interface NotificationToneMeta {
  icon: React.ReactNode;
  label: string;
  color: string;
  softBackground: string;
  borderColor: string;
}

interface NotificationEntityMeta {
  icon: React.ReactNode;
  label: string;
  actionLabel: string;
}

export const NOTIFICATION_TONE_META: Record<NotificationTone, NotificationToneMeta> = {
  info: {
    icon: <InfoCircleFilled />,
    label: 'Actualizacion',
    color: '#0f766e',
    softBackground: 'rgba(13, 148, 136, 0.12)',
    borderColor: 'rgba(13, 148, 136, 0.18)',
  },
  success: {
    icon: <CheckCircleFilled />,
    label: 'Confirmacion',
    color: '#15803d',
    softBackground: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  warning: {
    icon: <WarningFilled />,
    label: 'Aviso',
    color: '#b45309',
    softBackground: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  error: {
    icon: <CloseCircleFilled />,
    label: 'Atencion',
    color: '#b91c1c',
    softBackground: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
};

const ENTITY_META: Record<string, NotificationEntityMeta> = {
  case: {
    icon: <FolderOpenOutlined />,
    label: 'Caso',
    actionLabel: 'Abrir caso',
  },
  appointment: {
    icon: <CalendarOutlined />,
    label: 'Cita',
    actionLabel: 'Ver agenda',
  },
  payment: {
    icon: <FileTextOutlined />,
    label: 'Pago',
    actionLabel: 'Ver detalle',
  },
  contact_interest: {
    icon: <MailOutlined />,
    label: 'Contacto',
    actionLabel: 'Abrir contacto',
  },
  task: {
    icon: <ClockCircleOutlined />,
    label: 'Tarea',
    actionLabel: 'Ver caso',
  },
};

const SUPPORTED_TONES: NotificationTone[] = ['info', 'success', 'warning', 'error'];

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function extractNumericSuffix(link: string, pattern: RegExp): number | null {
  const match = link.match(pattern);
  if (!match || !match[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function normalizeNotificationType(type: string | null | undefined): NotificationTone {
  const lowered = String(type || '').trim().toLowerCase();
  if (SUPPORTED_TONES.includes(lowered as NotificationTone)) {
    return lowered as NotificationTone;
  }
  if (lowered.includes('error') || lowered.includes('failed')) {
    return 'error';
  }
  if (lowered.includes('warn') || lowered.includes('alert')) {
    return 'warning';
  }
  if (lowered.includes('success') || lowered.includes('confirmed') || lowered.includes('complete')) {
    return 'success';
  }
  return 'info';
}

export function resolveNotificationHref(notification: Pick<Notification, 'link'>): string | null {
  const raw = notification.link?.trim();
  if (!raw) return null;

  if (/^\/app\/appointments\/\d+$/.test(raw)) {
    return '/app/appointments';
  }

  if (/^\/app\/tasks\/\d+$/.test(raw)) {
    return '/app/cases';
  }

  return raw;
}

export function getNotificationToneMeta(type: string | null | undefined): NotificationToneMeta {
  return NOTIFICATION_TONE_META[normalizeNotificationType(type)];
}

export function getNotificationEntityMeta(notification: Pick<Notification, 'entityType' | 'link'>): NotificationEntityMeta | null {
  if (notification.entityType && ENTITY_META[notification.entityType]) {
    return ENTITY_META[notification.entityType];
  }

  const link = notification.link?.trim() || '';
  if (link.startsWith('/app/cases/')) {
    return ENTITY_META.case;
  }
  if (link.startsWith('/app/appointments')) {
    return ENTITY_META.appointment;
  }
  if (link.startsWith('/app/users/')) {
    return {
      icon: <BellOutlined />,
      label: 'Usuario',
      actionLabel: 'Abrir perfil',
    };
  }

  return null;
}

export function getNotificationTitle(notification: Notification): string {
  const title = notification.title?.trim();
  const message = notification.message?.trim() || 'Tienes una nueva notificacion.';

  if (title && title !== message) {
    return title;
  }

  if (notification.entityType === 'appointment') {
    return notification.type === 'success' ? 'Cita confirmada' : 'Actualizacion de cita';
  }

  if (notification.entityType === 'case') {
    return notification.type === 'success' ? 'Caso actualizado' : 'Actividad en caso';
  }

  if (notification.entityType === 'payment') {
    return 'Movimiento de pago';
  }

  if (notification.entityType === 'contact_interest') {
    return 'Nuevo contacto';
  }

  return getNotificationToneMeta(notification.type).label;
}

export function getNotificationLinkLabel(notification: Notification): string {
  const entityMeta = getNotificationEntityMeta(notification);
  if (entityMeta) {
    return entityMeta.actionLabel;
  }
  return resolveNotificationHref(notification) ? 'Abrir detalle' : 'Ver notificacion';
}

export function getNotificationAccentLabel(notification: Notification): string {
  const entityMeta = getNotificationEntityMeta(notification);
  const entityLabel = entityMeta?.label;
  const entityId =
    notification.entityId ??
    extractNumericSuffix(notification.link || '', /^\/app\/cases\/(\d+)$/) ??
    extractNumericSuffix(notification.link || '', /^\/app\/users\/(\d+)$/);

  if (entityLabel && entityId != null) {
    return `${entityLabel} #${entityId}`;
  }

  if (entityLabel) {
    return entityLabel;
  }

  return getNotificationToneMeta(notification.type).label;
}

export function formatNotificationTime(createdAt: string): { relative: string; full: string } {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return {
      relative: 'Reciente',
      full: 'Fecha no disponible',
    };
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const diffHours = Math.max(0, Math.floor(diffMs / 3600000));
  const diffDays = Math.max(0, Math.floor(diffMs / 86400000));

  let relative = 'Reciente';
  if (diffMinutes < 1) {
    relative = 'Ahora';
  } else if (diffMinutes < 60) {
    relative = `Hace ${diffMinutes} min`;
  } else if (diffHours < 24) {
    relative = `Hace ${diffHours} h`;
  } else if (diffDays === 1) {
    relative = 'Ayer';
  } else if (diffDays < 7) {
    relative = `Hace ${diffDays} dias`;
  } else {
    relative = date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
    });
  }

  return {
    relative,
    full: date.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  };
}

export function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return 'Sin sincronizar';

  const date = new Date(timestamp);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getNotificationSearchText(notification: Notification): string {
  return [
    notification.title,
    notification.message,
    notification.type,
    notification.entityType,
    getNotificationAccentLabel(notification),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function groupNotificationsByDay(notifications: Notification[]): Array<{ label: string; items: Notification[] }> {
  const groups = new Map<string, Notification[]>();
  const today = startOfLocalDay(new Date());
  const yesterday = today - 86400000;

  notifications.forEach((notification) => {
    const createdAt = new Date(notification.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      const existing = groups.get('Sin fecha') || [];
      groups.set('Sin fecha', [...existing, notification]);
      return;
    }

    const dayKey = startOfLocalDay(createdAt);
    let label = createdAt.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    if (dayKey === today) {
      label = 'Hoy';
    } else if (dayKey === yesterday) {
      label = 'Ayer';
    } else if (dayKey > today - 7 * 86400000) {
      label = createdAt.toLocaleDateString('es-MX', { weekday: 'long' });
    }

    const existing = groups.get(label) || [];
    groups.set(label, [...existing, notification]);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}
