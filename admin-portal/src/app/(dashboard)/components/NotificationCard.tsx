'use client';

import React from 'react';
import { Button, Tooltip } from 'antd';
import { ArrowRightOutlined, CheckOutlined } from '@ant-design/icons';
import type { Notification } from '@/context/NotificationContext';
import {
  formatNotificationTime,
  getNotificationAccentLabel,
  getNotificationLinkLabel,
  getNotificationTitle,
  getNotificationToneMeta,
  resolveNotificationHref,
} from './notificationPresentation';

function clampLines(lines: number): React.CSSProperties {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  };
}

export interface NotificationCardProps {
  notification: Notification;
  onClick?: () => void;
  onMarkAsRead?: () => void;
  compact?: boolean;
}

export default function NotificationCard({
  notification,
  onClick,
  onMarkAsRead,
  compact = false,
}: NotificationCardProps) {
  const tone = getNotificationToneMeta(notification.type);
  const { relative, full } = formatNotificationTime(notification.createdAt);
  const accentLabel = getNotificationAccentLabel(notification);
  const title = getNotificationTitle(notification);
  const hasDestination = Boolean(resolveNotificationHref(notification));
  const canOpen = Boolean(onClick && hasDestination);
  const showMarkAction = Boolean(onMarkAsRead && !notification.isRead);
  const openLabel = getNotificationLinkLabel(notification);

  const handleCardClick = () => {
    if (!canOpen || !onClick) return;
    onClick();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canOpen || !onClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick();
  };

  return (
    <div
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={`group relative overflow-hidden rounded-3xl border transition-all duration-200 ${
        notification.isRead
          ? 'border-slate-200 bg-white/75'
          : 'border-sky-200 bg-white shadow-[0_16px_40px_rgba(14,165,233,0.08)]'
      } ${canOpen ? 'cursor-pointer hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_20px_48px_rgba(15,23,42,0.12)]' : ''}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: notification.isRead ? '#cbd5e1' : tone.color }}
      />
      <div className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${
              compact ? 'mt-0.5' : ''
            }`}
            style={{
              backgroundColor: tone.softBackground,
              color: tone.color,
              border: `1px solid ${tone.borderColor}`,
            }}
          >
            {tone.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                {accentLabel}
              </span>
              {!notification.isRead && (
                <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                  Nuevo
                </span>
              )}
              <Tooltip title={full}>
                <span className="text-xs font-medium text-slate-500">{relative}</span>
              </Tooltip>
            </div>

            <div className={compact ? 'mt-2 space-y-1.5' : 'mt-3 space-y-2'}>
              <h3
                className={`font-semibold text-slate-900 ${compact ? 'text-sm' : 'text-base'}`}
                style={compact ? clampLines(1) : undefined}
              >
                {title}
              </h3>
              <p
                className={`text-slate-600 ${compact ? 'text-sm leading-6' : 'text-sm leading-6'}`}
                style={compact ? clampLines(2) : undefined}
              >
                {notification.message}
              </p>
            </div>

            {(canOpen || showMarkAction) && (
              <div className={`flex flex-wrap items-center gap-2 ${compact ? 'mt-3' : 'mt-4'}`}>
                {canOpen && (
                  <Button
                    size="small"
                    type={compact ? 'text' : 'default'}
                    className={compact ? '!px-0 !text-sky-700 hover:!text-sky-800' : ''}
                    icon={<ArrowRightOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClick?.();
                    }}
                  >
                    {openLabel}
                  </Button>
                )}

                {showMarkAction && (
                  <Button
                    size="small"
                    type="text"
                    icon={<CheckOutlined />}
                    className="!text-slate-500 hover:!text-slate-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMarkAsRead?.();
                    }}
                  >
                    Marcar como leida
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
