'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';

// Types for notification data
export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  userId?: number;
  link?: string; // Optional link for clickable notifications
}

// Context interface
interface NotificationContextType {
  // State
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  clearError: () => void;
  login: (token: string) => void;
}

// Create the context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider component props
interface NotificationProviderProps {
  children: ReactNode;
}

  // Provider component
export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // State management
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const isHydrated = useHydrationSafe();

  // Calculate unread count from notifications
  useEffect(() => {
    const unread = notifications.filter(notification => !notification.isRead).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Fetch notifications from API
  const fetchNotifications = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Mark a single notification as read
  const markAsRead = async (notificationId: number): Promise<void> => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark notification as read: ${response.statusText}`);
      }

      // Update local state optimistically
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          notificationIds: notifications.filter(n => !n.isRead).map(n => n.id) 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark all notifications as read: ${response.statusText}`);
      }

      // Update local state optimistically
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
    }
  };

  // Refresh notifications (manual refresh)
  const refreshNotifications = async (): Promise<void> => {
    await fetchNotifications();
  };

  // Clear error state
  const clearError = (): void => {
    setError(null);
  };

  // Login function to handle authentication and initial notification fetch
  const login = (token: string): void => {
    try {
      // Store the token in localStorage
      localStorage.setItem('token', token);
      
      // Set authenticated state
      setIsAuthenticated(true);
      
      // Immediately fetch notifications after setting the token
      fetchNotifications();
    } catch (error) {
      console.error('Error during notification login:', error);
      setError('Failed to initialize notifications after login');
    }
  };

  // Check for authentication status on mount only
  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration to complete

    const checkAuthStatus = () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      if (token && !isAuthenticated) {
        setIsAuthenticated(true);
        // Temporarily disable automatic fetching to prevent loops
        console.log('Authentication detected, but auto-fetch disabled');
      } else if (!token && isAuthenticated) {
        setIsAuthenticated(false);
        setNotifications([]);
        setUnreadCount(0);
        setError(null);
      }
    };

    checkAuthStatus();
  }, [isHydrated, isAuthenticated]); // Run only once on mount

  // Periodic refresh completely disabled to prevent infinite loops
  // TODO: Re-enable once the loop issue is resolved

  // Context value
  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    clearError,
    login,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook for consuming the context
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  
  return context;
};

// Export the context for advanced use cases
export { NotificationContext };
