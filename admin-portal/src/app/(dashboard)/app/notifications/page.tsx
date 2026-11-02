'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
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
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    clearError,
  } = useNotifications();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Notification['type']>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchValue, setSearchValue] = useState('');

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
        message.error('No fue posible actualizar la notificación.');
        return;
      }
    }

    const href = resolveNotificationHref(notification);
    if (href) router.push(href);
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markAsRead(notificationId);
    } catch {
      message.error('No fue posible actualizar la notificación.');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      await markAllAsRead();
      message.success('Notificaciones actualizadas.');
    } catch {
      message.error('No fue posible actualizar las notificaciones.');
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshNotifications();
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
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Title level={2} className="!mb-0 flex items-center gap-3">
          <BellOutlined className="text-blue-600" /> Notificaciones
        </Title>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void handleRefresh()}
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
            Marcar todo como leído
          </Button>
        </Space>
      </header>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card size="small" className="border-l-4 border-l-blue-500">
            <Statistic title="Sin leer" value={unreadCount} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="border-l-4 border-l-slate-300">
            <Statistic title="Leídas" value={readCount} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="border-l-4 border-l-cyan-500">
            <Statistic title="Total" value={notifications.length} />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.7fr))]">
          <Input
            allowClear
            placeholder="Buscar notificaciones"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <Select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(value: StatusFilter) => setStatusFilter(value)}
            options={[
              { label: 'Todas', value: 'all' },
              { label: 'Sin leer', value: 'unread' },
              { label: 'Leídas', value: 'read' },
            ]}
          />
          <Select
            aria-label="Filtrar por tipo"
            value={typeFilter}
            onChange={(value: 'all' | Notification['type']) => setTypeFilter(value)}
            options={typeOptions}
          />
          <Select
            aria-label="Ordenar notificaciones"
            value={sortOrder}
            onChange={(value: SortOrder) => setSortOrder(value)}
            options={[
              { label: 'Más recientes', value: 'newest' },
              { label: 'Más antiguas', value: 'oldest' },
            ]}
          />
        </div>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={clearError}
          message="No fue posible cargar las notificaciones"
          description={error}
        />
      )}

      {isLoading && notifications.length === 0 ? (
        <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
      ) : groupedNotifications.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchValue || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No hay resultados para estos filtros.'
                : 'No hay notificaciones.'
            }
          />
          {(searchValue || statusFilter !== 'all' || typeFilter !== 'all') && (
            <div className="mt-4 text-center">
              <Button onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedNotifications.map((group) => (
            <section key={group.label}>
              <div className="mb-3 flex items-center gap-3 border-b border-slate-200 pb-2">
                <h2 className="text-base font-semibold text-slate-900">{group.label}</h2>
                <Text type="secondary" className="text-xs">
                  {group.items.length}
                </Text>
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
                        : () => void handleMarkAsRead(notification.id)
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
