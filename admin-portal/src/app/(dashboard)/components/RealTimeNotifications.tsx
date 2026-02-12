'use client';

import React from 'react';
import { Card, List, Badge, Button, Typography, Tag, Tooltip, Empty, Spin } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/context/NotificationContext';

const { Text } = Typography;

/**
 * RealTimeNotifications: uses global NotificationContext (real API data).
 * No mock data; mark-as-read uses context; no delete (API does not support delete).
 */
const RealTimeNotifications: React.FC = () => {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refreshNotifications } = useNotifications();
  const displayList = notifications.slice(0, 5);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'error': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="Cargando notificaciones..." />
      </div>
    );
  }

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BellOutlined className="mr-2 text-blue-500" />
            Notificaciones Recientes
          </div>
          <Badge count={unreadCount} size="small" showZero={false}>
            <Button
              type="text"
              size="small"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              Marcar todas como leídas
            </Button>
          </Badge>
        </div>
      }
      className="h-full"
      extra={
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => router.push('/app/notifications')}
        >
          Ver Todas
        </Button>
      }
    >
      {displayList.length > 0 ? (
        <List
          dataSource={displayList}
          renderItem={(notification) => (
            <List.Item
              className={`!px-0 py-3 border-b border-gray-100 last:border-b-0 ${
                !notification.isRead ? 'bg-blue-50' : ''
              }`}
              style={{ cursor: notification.link ? 'pointer' : 'default' }}
              onClick={() => notification.link && router.push(notification.link)}
              actions={[
                <Tooltip title="Marcar como leída" key="read">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    disabled={notification.isRead}
                  />
                </Tooltip>,
              ]}
            >
              <List.Item.Meta
                avatar={getTypeIcon(notification.type)}
                title={
                  <Text strong className={`text-sm ${!notification.isRead ? 'text-blue-600' : ''}`}>
                    {notification.title || notification.message}
                  </Text>
                }
                description={
                  <Text type="secondary" className="text-xs">
                    {new Date(notification.createdAt).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty
          description="No hay notificaciones nuevas"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  );
};

export default RealTimeNotifications;
