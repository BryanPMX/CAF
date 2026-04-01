'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Skeleton,
  Space,
  Typography,
  message,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useNotifications, type Notification } from '@/context/NotificationContext';
import NotificationCard from '../../components/NotificationCard';
import {
  formatSyncTime,
  getNotificationSearchText,
  getNotificationToneMeta,
  groupNotificationsByDay,
  resolveNotificationHref,
} from '../../components/notificationPresentation';

const { Title, Text } = Typography;

type StatusFilter = 'all' | 'unread' | 'read';
type SortOrder = 'newest' | 'oldest';

export default function NotificationsPage() {
  const router = useRouter();
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Notification['type']>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const typeOptions = useMemo(() => {
    const uniqueTypes = Array.from(new Set(notifications.map((item) => item.type)));
    return [
      { label: 'Todos los tipos', value: 'all' },
      ...uniqueTypes.map((type) => ({
        label: getNotificationToneMeta(type).label,
        value: type,
      })),
    ];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const next = notifications.filter((notification) => {
      if (statusFilter === 'unread' && notification.isRead) return false;
      if (statusFilter === 'read' && !notification.isRead) return false;
      if (typeFilter !== 'all' && notification.type !== typeFilter) return false;
      if (query && !getNotificationSearchText(notification).includes(query)) return false;
      return true;
    });

    next.sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return sortOrder === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });

    return next;
  }, [notifications, searchValue, sortOrder, statusFilter, typeFilter]);

  const groupedNotifications = useMemo(
    () => groupNotificationsByDay(filteredNotifications),
    [filteredNotifications]
  );

  const readCount = notifications.length - unreadCount;

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
      router.push(href);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      message.info('No hay notificaciones sin leer.');
      return;
    }

    try {
      await markAllAsRead();
      message.success('Todas las notificaciones fueron marcadas como leidas.');
    } catch {
      message.error('No fue posible actualizar las notificaciones.');
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSortOrder('newest');
    setSearchValue('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-2xl text-sky-700 shadow-inner">
              <BellOutlined />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Title level={2} className="!mb-0">
                  Centro de notificaciones
                </Title>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  wsConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {wsConnected ? 'Sincronizacion en vivo' : 'Reconectando'}
                </span>
              </div>
              <Text type="secondary" className="mt-2 block text-sm">
                Mantente al dia con actividad de casos, citas y eventos relevantes del portal.
              </Text>
              <Text type="secondary" className="mt-1 block text-xs">
                Ultima sincronizacion: {formatSyncTime(lastUpdatedAt)}
              </Text>
            </div>
          </div>

          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void refreshNotifications()}
              loading={isRefreshing}
            >
              Actualizar
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled={unreadCount === 0}
              loading={isRefreshing}
              onClick={() => void handleMarkAllAsRead()}
            >
              Marcar todo como leido
            </Button>
          </Space>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sin leer</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{unreadCount}</div>
            <div className="mt-1 text-sm text-slate-500">Elementos que requieren atencion.</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Leidas</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{readCount}</div>
            <div className="mt-1 text-sm text-slate-500">Historial reciente revisado por el equipo.</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{notifications.length}</div>
            <div className="mt-1 text-sm text-slate-500">Bandeja consolidada de todo el portal administrativo.</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.6fr))]">
          <Input
            allowClear
            size="large"
            placeholder="Buscar por mensaje, caso o contexto"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />

          <Select
            size="large"
            value={statusFilter}
            onChange={(value: StatusFilter) => setStatusFilter(value)}
            options={[
              { label: 'Todas', value: 'all' },
              { label: 'Sin leer', value: 'unread' },
              { label: 'Leidas', value: 'read' },
            ]}
          />

          <Select
            size="large"
            value={typeFilter}
            onChange={(value: 'all' | Notification['type']) => setTypeFilter(value)}
            options={typeOptions}
          />

          <Select
            size="large"
            value={sortOrder}
            onChange={(value: SortOrder) => setSortOrder(value)}
            options={[
              { label: 'Mas recientes', value: 'newest' },
              { label: 'Mas antiguas', value: 'oldest' },
            ]}
          />
        </div>
      </section>

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={clearError}
          message="No pudimos completar la sincronizacion"
          description={error}
        />
      )}

      {isLoading && notifications.length === 0 ? (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        </section>
      ) : groupedNotifications.length === 0 ? (
        <section className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchValue || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No encontramos notificaciones con esos filtros.'
                : 'No hay notificaciones en este momento.'
            }
          />
          {(searchValue || statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button className="mt-4" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </section>
      ) : (
        <div className="space-y-5">
          {groupedNotifications.map((group) => (
            <section
              key={group.label}
              className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{group.label}</h2>
                  <p className="text-sm text-slate-500">
                    {group.items.length} {group.items.length === 1 ? 'notificacion' : 'notificaciones'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {group.items.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
