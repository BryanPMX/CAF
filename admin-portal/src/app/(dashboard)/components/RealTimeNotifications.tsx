'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, Badge, Button, Space, Typography, Tag, Avatar, Tooltip, Empty, Spin } from 'antd';
import { 
  BellOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  InfoCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  EyeOutlined,
  DeleteOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';

const { Text, Title } = Typography;

interface Notification {
  id: string;
  type: 'appointment' | 'case' | 'system' | 'user';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  userId?: string;
  userName?: string;
}

const RealTimeNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      
      // Mock data for demonstration - replace with actual API call
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'appointment',
          priority: 'high',
          title: 'Nueva Cita Programada',
          message: 'Se ha programado una nueva cita para mañana a las 10:00 AM',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          read: false,
          actionUrl: '/app/appointments',
          userId: 'user1',
          userName: 'María García'
        },
        {
          id: '2',
          type: 'case',
          priority: 'urgent',
          title: 'Caso Urgente Requiere Atención',
          message: 'El caso #1234 requiere revisión inmediata',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          read: false,
          actionUrl: '/app/cases/1234',
          userId: 'user2',
          userName: 'Juan Pérez'
        },
        {
          id: '3',
          type: 'system',
          priority: 'medium',
          title: 'Actualización del Sistema',
          message: 'El sistema se actualizará esta noche a las 2:00 AM',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          read: true,
          actionUrl: '/admin/system'
        },
        {
          id: '4',
          type: 'user',
          priority: 'low',
          title: 'Nuevo Usuario Registrado',
          message: 'Ana López se ha registrado en el sistema',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          read: true,
          actionUrl: '/admin/users',
          userId: 'user3',
          userName: 'Ana López'
        },
        {
          id: '5',
          type: 'appointment',
          priority: 'medium',
          title: 'Cita Cancelada',
          message: 'La cita del viernes ha sido cancelada por el cliente',
          timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          read: true,
          actionUrl: '/app/appointments',
          userId: 'user4',
          userName: 'Carlos Ruiz'
        }
      ];

      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time updates (WebSocket or polling)
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // API call to mark as read
      await apiClient.patch(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      setUnreadCount(0);
      
      // API call to mark all as read
      await apiClient.patch('/notifications/mark-all-read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.read ? Math.max(0, prev - 1) : prev;
      });
      
      // API call to delete notification
      await apiClient.delete(`/notifications/${notificationId}`);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ff4d4f';
      case 'high': return '#fa8c16';
      case 'medium': return '#1890ff';
      case 'low': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'appointment': return <CalendarOutlined />;
      case 'case': return <FileTextOutlined />;
      case 'user': return <UserOutlined />;
      case 'system': return <SettingOutlined />;
      default: return <InfoCircleOutlined />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <ExclamationCircleOutlined />;
      case 'high': return <ExclamationCircleOutlined />;
      case 'medium': return <InfoCircleOutlined />;
      case 'low': return <CheckCircleOutlined />;
      default: return <InfoCircleOutlined />;
    }
  };

  if (loading) {
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
            Notificaciones en Tiempo Real
          </div>
          <Badge count={unreadCount} showZero={false}>
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
          onClick={() => window.location.href = '/app/notifications'}
        >
          Ver Todas
        </Button>
      }
    >
      {notifications.length > 0 ? (
        <List
          dataSource={notifications.slice(0, 5)}
          renderItem={(notification) => (
            <List.Item 
              className={`!px-0 py-3 border-b border-gray-100 last:border-b-0 ${
                !notification.read ? 'bg-blue-50' : ''
              }`}
              actions={[
                <Tooltip title="Marcar como leída" key="read">
                  <Button 
                    type="text" 
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={() => markAsRead(notification.id)}
                    disabled={notification.read}
                  />
                </Tooltip>,
                <Tooltip title="Eliminar" key="delete">
                  <Button 
                    type="text" 
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => deleteNotification(notification.id)}
                    danger
                  />
                </Tooltip>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    size="small" 
                    style={{ 
                      backgroundColor: getPriorityColor(notification.priority),
                      color: 'white'
                    }}
                  >
                    {getTypeIcon(notification.type)}
                  </Avatar>
                }
                title={
                  <div className="flex items-center gap-2">
                    <Typography.Text 
                      strong 
                      className={`text-sm ${!notification.read ? 'text-blue-600' : ''}`}
                    >
                      {notification.title}
                    </Typography.Text>
                    <Tag 
                      color={getPriorityColor(notification.priority)}
                      icon={getPriorityIcon(notification.priority)}
                      className="text-xs"
                    >
                      {notification.priority.toUpperCase()}
                    </Tag>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                }
                description={
                  <div>
                    <Typography.Text type="secondary" className="text-xs">
                      {notification.message}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary" className="text-xs">
                      {notification.userName && `${notification.userName} • `}
                      {new Date(notification.timestamp).toLocaleString()}
                    </Typography.Text>
                  </div>
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
