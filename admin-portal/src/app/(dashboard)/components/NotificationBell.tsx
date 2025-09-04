'use client';

import React from 'react';
import { Badge, Button } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/context/NotificationContext';

/**
 * NotificationBell Component
 * 
 * A simple, stable presentational component that displays the notification count
 * and handles navigation to the notifications page. This component is now
 * decoupled from data fetching logic, which is handled by the NotificationContext.
 * 
 * Benefits of this refactor:
 * - Eliminates HMR instability by removing local state management
 * - Follows Single Responsibility Principle (only handles UI presentation)
 * - Reduces component complexity and improves maintainability
 * - Enables consistent notification state across the entire application
 */
export default function NotificationBell() {
  const router = useRouter();
  
  // Consume notification state from context
  const { unreadCount, isLoading } = useNotifications();

  // Handle click on notification bell
  const handleNotificationClick = () => {
    router.push('/app/notifications');
  };

  return (
    <Badge count={unreadCount} size="small" offset={[-5, 5]}>
      <Button
        type="text"
        icon={<BellOutlined />}
        onClick={handleNotificationClick}
        loading={isLoading}
        style={{
          color: '#666',
          fontSize: '16px',
          height: '40px',
          width: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Centro de Notificaciones"
      />
    </Badge>
  );
}
