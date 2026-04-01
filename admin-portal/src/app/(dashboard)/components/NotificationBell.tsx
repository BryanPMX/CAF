'use client';

import React, { useState } from 'react';
import { Alert, Badge, Button, Empty, Popover, Skeleton, Space, Typography } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useNotifications, type Notification } from '@/context/NotificationContext';
import NotificationCard from './NotificationCard';
import {
  formatSyncTime,
  resolveNotificationHref,
} from './notificationPresentation';

const { Text } = Typography;

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    wsConnected,
    lastUpdatedAt,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    clearError,
  } = useNotifications();

  const previewNotifications = notifications.slice(0, 4);

  const handleOpenNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
      } catch {
        return;
      }
    }

    const href = resolveNotificationHref(notification);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  const handleOpenCenter = () => {
    setOpen(false);
    router.push('/app/notifications');
  };

  const content = (
    <div className="w-[380px] max-w-[calc(100vw-32px)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Centro de notificaciones</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span>{wsConnected ? 'En vivo' : 'Reconectando'}</span>
            <span>Actualizado {formatSyncTime(lastUpdatedAt)}</span>
          </div>
        </div>

        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          loading={isRefreshing}
          onClick={() => void refreshNotifications()}
          aria-label="Actualizar notificaciones"
        />
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={clearError}
          message="No pudimos sincronizar las notificaciones"
          description={error}
          className="mt-4"
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sin leer</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{unreadCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{notifications.length}</div>
        </div>
      </div>

      <div className="mt-4">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-3">
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          </div>
        ) : previewNotifications.length > 0 ? (
          <div className="space-y-3">
            {previewNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                compact
                onClick={() => void handleOpenNotification(notification)}
                onMarkAsRead={
                  notification.isRead
                    ? undefined
                    : () => {
                        void markAsRead(notification.id);
                      }
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-6">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No hay notificaciones recientes"
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="text"
          icon={<CheckOutlined />}
          disabled={unreadCount === 0}
          onClick={() => void markAllAsRead()}
        >
          Marcar todo
        </Button>
        <Space size={8}>
          <Text type="secondary" className="text-xs">
            Bandeja completa
          </Text>
          <Button type="primary" onClick={handleOpenCenter} icon={<RightOutlined />}>
            Abrir
          </Button>
        </Space>
      </div>
    </div>
  );

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      content={content}
      overlayClassName="notification-bell-popover"
    >
      <Badge count={unreadCount} overflowCount={99} size="small">
        <Button
          type="text"
          icon={<BellOutlined />}
          aria-label="Abrir centro de notificaciones"
          className={`notification-bell-button ${
            open || unreadCount > 0 ? 'notification-bell-button-active' : ''
          }`}
        />
      </Badge>
    </Popover>
  );
}
