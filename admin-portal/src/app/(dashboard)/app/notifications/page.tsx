'use client';

import React from 'react';
import {
  Button,
  Typography,
  Space,
  Tag,
  Spin,
  message,
  Empty,
  Card,
  Alert,
  Tabs,
} from 'antd';
import {
  CheckOutlined,
  BellOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useNotifications, type Notification } from '@/context/NotificationContext';
import NotificationCard from '../../components/NotificationCard';

const { Title, Text } = Typography;

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    clearError,
  } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      message.info('No hay notificaciones sin leer');
      return;
    }
    try {
      await markAllAsRead();
      message.success('Todas las notificaciones han sido marcadas como leídas');
    } catch {
      message.error('Error al marcar las notificaciones como leídas');
    }
  };

  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BellOutlined style={{ fontSize: 28, color: '#1890ff' }} />
            <div>
              <Title level={2} style={{ margin: 0 }}>Centro de Notificaciones</Title>
              <Text type="secondary">Gestiona tus avisos y mensajes</Text>
            </div>
            {unreadCount > 0 && (
              <Tag color="blue" style={{ fontSize: 14 }}>
                {unreadCount} sin leer
              </Tag>
            )}
          </div>
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={refreshNotifications}
              loading={isLoading}
            >
              Actualizar
            </Button>
            {unreadCount > 0 && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleMarkAllAsRead}
                loading={isLoading}
              >
                Marcar todas como leídas
              </Button>
            )}
          </Space>
        </div>

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            className="mb-4"
            closable
            onClose={clearError}
          />
        )}

        {isLoading && notifications.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="Cargando notificaciones..." />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="No hay notificaciones"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Tabs
            defaultActiveKey="all"
            items={[
              {
                key: 'all',
                label: `Todas (${notifications.length})`,
                children: (
                  <div className="space-y-3 mt-2">
                    {notifications.map((n) => (
                      <NotificationCard
                        key={n.id}
                        notification={n}
                        onClick={() => handleNotificationClick(n)}
                        compact={false}
                      />
                    ))}
                  </div>
                ),
              },
              {
                key: 'unread',
                label: `Sin leer (${unread.length})`,
                children: (
                  <div className="space-y-3 mt-2">
                    {unread.length === 0 ? (
                      <Empty description="No hay notificaciones sin leer" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      unread.map((n) => (
                        <NotificationCard
                          key={n.id}
                          notification={n}
                          onClick={() => handleNotificationClick(n)}
                          compact={false}
                        />
                      ))
                    )}
                  </div>
                ),
              },
              {
                key: 'read',
                label: `Leídas (${read.length})`,
                children: (
                  <div className="space-y-3 mt-2">
                    {read.length === 0 ? (
                      <Empty description="No hay notificaciones leídas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      read.map((n) => (
                        <NotificationCard
                          key={n.id}
                          notification={n}
                          onClick={() => handleNotificationClick(n)}
                          compact={false}
                        />
                      ))
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
