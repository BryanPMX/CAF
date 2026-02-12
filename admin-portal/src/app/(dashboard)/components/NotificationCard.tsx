'use client';

import React from 'react';
import { Typography, Tag, Tooltip } from 'antd';
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { Notification } from '@/context/NotificationContext';

const { Text } = Typography;

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  success: { icon: <CheckCircleOutlined />, color: '#52c41a', label: 'Éxito' },
  warning: { icon: <WarningOutlined />, color: '#faad14', label: 'Aviso' },
  error: { icon: <CloseCircleOutlined />, color: '#ff4d4f', label: 'Error' },
  info: { icon: <InfoCircleOutlined />, color: '#1890ff', label: 'Info' },
};

const ENTITY_LABELS: Record<string, string> = {
  case: 'Caso',
  appointment: 'Cita',
  contact_interest: 'Contacto',
};

export function formatNotificationTime(createdAt: string): { relative: string; full: string } {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  let relative: string;
  if (diffMins < 1) relative = 'Ahora';
  else if (diffMins < 60) relative = `Hace ${diffMins} min`;
  else if (diffHours < 24) relative = `Hace ${diffHours} h`;
  else if (diffDays < 7) relative = `Hace ${diffDays} d`;
  else relative = date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  const full = date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  return { relative, full };
}

export interface NotificationCardProps {
  notification: Notification;
  onClick?: () => void;
  compact?: boolean;
}

/**
 * Single-responsibility presentational card for one notification.
 * Used by dashboard (compact) and notifications page (full) for consistent UI.
 */
export default function NotificationCard({ notification, onClick, compact = false }: NotificationCardProps) {
  const typeConfig = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const { relative, full } = formatNotificationTime(notification.createdAt);
  const entityLabel = notification.entityType ? ENTITY_LABELS[notification.entityType] || notification.entityType : null;

  const content = (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && e.preventDefault() && onClick()}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border border-gray-100 transition-colors hover:border-gray-200 ${
        compact ? 'p-3' : 'p-4'
      }`}
      style={{
        backgroundColor: notification.isRead ? '#fafafa' : '#f0f8ff',
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${notification.isRead ? '#e5e7eb' : typeConfig.color}`,
      }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: typeConfig.color, fontSize: compact ? 16 : 18 }}>
        {typeConfig.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {entityLabel && (
            <Tag color="blue" className="!m-0 text-xs">
              {entityLabel}
              {notification.entityId != null && ` #${notification.entityId}`}
            </Tag>
          )}
          <Tooltip title={full}>
            <Text type="secondary" className="text-xs">
              {relative}
            </Text>
          </Tooltip>
          {!notification.isRead && (
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 shrink-0" aria-label="No leída" />
          )}
        </div>
        <Text
          className={`block text-gray-800 break-words ${compact ? 'text-sm' : 'text-base'}`}
          style={{
            lineHeight: 1.4,
            ...(compact
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {notification.message}
        </Text>
      </div>
      {onClick && notification.link && (
        <span className="shrink-0 text-gray-400 mt-0.5" aria-hidden>
          <RightOutlined className="text-xs" />
        </span>
      )}
    </div>
  );

  return onClick ? (
    <Tooltip title={notification.link ? 'Ver detalles' : undefined}>
      {content}
    </Tooltip>
  ) : (
    content
  );
}
