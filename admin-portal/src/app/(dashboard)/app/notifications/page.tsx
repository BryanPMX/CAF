'use client';

import React from 'react';
import { 
  List, 
  Button, 
  Typography, 
  Space, 
  Tag, 
  Spin, 
  message, 
  Empty,
  Card,
  Alert
} from 'antd';
import { 
  CheckOutlined, 
  ClockCircleOutlined, 
  BellOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useNotifications, Notification } from '@/context/NotificationContext';

const { Title, Text } = Typography;

/**
 * NotificationsPage Component
 * 
 * A refactored component that consumes notification data from the global context
 * instead of managing its own state. This eliminates HMR instability and provides
 * consistent notification state across the application.
 * 
 * Benefits of this refactor:
 * - Removes local state management and data fetching
 * - Eliminates HMR instability by decoupling from layout lifecycle
 * - Provides real-time notification updates through context
 * - Reduces component complexity and improves maintainability
 * - Enables consistent error handling and loading states
 */
export default function NotificationsPage() {
  const router = useRouter();
  
  // Consume notification state and actions from context
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    error, 
    markAllAsRead, 
    refreshNotifications,
    clearError 
  } = useNotifications();

  // Handle mark all as read with user feedback
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      message.info('No hay notificaciones sin leer');
      return;
    }

    try {
      await markAllAsRead();
      message.success('Todas las notificaciones han sido marcadas como leídas');
    } catch (err) {
      message.error('Error al marcar las notificaciones como leídas');
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Navigate to the notification link if it exists
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Get notification type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  // Get notification type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Hace un momento';
    } else if (diffInHours < 24) {
      return `Hace ${Math.floor(diffInHours)} horas`;
    } else {
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <BellOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <Title level={2} style={{ margin: 0 }}>Centro de Notificaciones</Title>
            {unreadCount > 0 && (
              <Tag color="blue" style={{ fontSize: '14px' }}>
                {unreadCount} sin leer
              </Tag>
            )}
          </div>
          
          <Space>
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

        {/* Error Alert */}
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

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="No hay notificaciones"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                style={{
                  padding: '16px',
                  marginBottom: '8px',
                  borderRadius: '8px',
                  backgroundColor: notification.isRead ? '#fafafa' : '#f0f8ff',
                  border: notification.isRead ? '1px solid #f0f0f0' : '1px solid #d6e4ff',
                  cursor: notification.link ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => handleNotificationClick(notification)}
                className={notification.link ? 'hover:shadow-md' : ''}
              >
                <List.Item.Meta
                  avatar={getTypeIcon(notification.type)}
                  title={
                    <Space>
                      <Text strong style={{ fontSize: '16px' }}>
                        {notification.title || notification.message}
                      </Text>
                      {!notification.isRead && (
                        <Tag color="blue" size="small">Nuevo</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space size="small" className="mt-2">
                      <Tag color={getTypeColor(notification.type)} size="small">
                        {notification.type}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        <ClockCircleOutlined style={{ marginRight: '4px' }} />
                        {formatDate(notification.createdAt)}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
