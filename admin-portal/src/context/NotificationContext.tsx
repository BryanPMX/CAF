'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { notification as antNotification } from 'antd';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/app/lib/api';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/context/AuthContext';
import {
  getNotificationTitle,
  normalizeNotificationType,
  resolveNotificationHref,
} from '@/app/(dashboard)/components/notificationPresentation';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  userId?: number;
  link?: string;
  entityType?: string;
  entityId?: number;
}

interface NotificationApiItem {
  id: number;
  message: string;
  title?: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  entityType?: string;
  entityId?: number;
}

interface NotificationListResponse {
  notifications?: NotificationApiItem[];
  unread_count?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  wsConnected: boolean;
  lastUpdatedAt: number | null;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  clearError: () => void;
}

interface NotificationProviderProps {
  children: ReactNode;
}

interface RealtimeNotificationPayload {
  type?: string;
  message?: string;
  title?: string;
  link?: string;
  entityType?: string;
  entityId?: number;
  appointment?: {
    id?: number;
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function normalizeNotification(item: NotificationApiItem): Notification {
  const normalizedType = normalizeNotificationType(item.type);
  const normalized: Notification = {
    id: item.id,
    title: item.title?.trim() || item.message?.trim() || 'Notificacion',
    message: item.message?.trim() || 'Tienes una nueva notificacion.',
    type: normalizedType,
    isRead: Boolean(item.isRead),
    createdAt: item.createdAt,
    link: item.link,
    entityType: item.entityType,
    entityId: item.entityId,
  };

  return normalized;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) {
      return response.data.error;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeRealtimePayload(payload: unknown): RealtimeNotificationPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload as RealtimeNotificationPayload;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const router = useRouter();
  const isHydrated = useHydrationSafe();
  const { user, isAuthenticated } = useAuth();
  const { isConnected: wsConnected, lastMessage } = useWebSocket();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const fetchRequestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const lastRealtimeRefreshRef = useRef(0);
  const previousWsConnectedRef = useRef(false);
  const lastToastRef = useRef<{ signature: string; at: number } | null>(null);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.isRead ? 0 : 1), 0),
    [notifications]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetState = useCallback(() => {
    fetchRequestIdRef.current += 1;
    hasLoadedRef.current = false;
    setNotifications([]);
    setError(null);
    setIsLoading(false);
    setIsRefreshing(false);
    setLastUpdatedAt(null);
  }, []);

  const fetchNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isHydrated || !isAuthenticated || !user?.id) {
        resetState();
        return;
      }

      const requestId = ++fetchRequestIdRef.current;
      const silent = Boolean(options?.silent || hasLoadedRef.current);

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await apiClient.get<NotificationListResponse>('/notifications');
        if (requestId !== fetchRequestIdRef.current) return;

        const nextNotifications = Array.isArray(response.data.notifications)
          ? response.data.notifications.map(normalizeNotification)
          : [];

        nextNotifications.sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime();
          const rightTime = new Date(right.createdAt).getTime();
          return rightTime - leftTime;
        });

        hasLoadedRef.current = true;
        setNotifications(nextNotifications);
        setLastUpdatedAt(Date.now());
      } catch (fetchError) {
        if (requestId !== fetchRequestIdRef.current) return;

        const nextError = extractErrorMessage(fetchError, 'No fue posible cargar las notificaciones.');
        setError(nextError);
        throw fetchError instanceof Error ? fetchError : new Error(nextError);
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [isAuthenticated, isHydrated, resetState, user?.id]
  );

  const refreshNotifications = useCallback(async (): Promise<void> => {
    await fetchNotifications({ silent: true });
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (notificationId: number): Promise<void> => {
      const target = notifications.find((notificationItem) => notificationItem.id === notificationId);
      if (!target || target.isRead) return;

      setError(null);

      try {
        await apiClient.post('/notifications/mark-read', {
          notificationIds: [notificationId],
        });

        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId
              ? {
                  ...item,
                  isRead: true,
                }
              : item
          )
        );
        setLastUpdatedAt(Date.now());
      } catch (markError) {
        const nextError = extractErrorMessage(markError, 'No fue posible actualizar la notificacion.');
        setError(nextError);
        throw markError instanceof Error ? markError : new Error(nextError);
      }
    },
    [notifications]
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    const unreadIds = notifications.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadIds.length === 0) return;

    setError(null);
    setIsRefreshing(true);

    try {
      await apiClient.post('/notifications/mark-read', {
        notificationIds: unreadIds,
      });

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
        }))
      );
      setLastUpdatedAt(Date.now());
    } catch (markError) {
      const nextError = extractErrorMessage(markError, 'No fue posible marcar las notificaciones como leidas.');
      setError(nextError);
      throw markError instanceof Error ? markError : new Error(nextError);
    } finally {
      setIsRefreshing(false);
    }
  }, [notifications]);

  const showRealtimeToast = useCallback(
    (payload: RealtimeNotificationPayload) => {
      const normalizedType = normalizeNotificationType(payload.type);
      const toastLink =
        payload.type === 'appointment_updated'
          ? '/app/appointments'
          : resolveNotificationHref({ link: payload.link });

      const description = payload.message?.trim() || 'Tienes una nueva notificacion.';
      const toastNotification: Notification = {
        id: -1,
        title: payload.title?.trim() || description,
        message: description,
        type: normalizedType,
        isRead: false,
        createdAt: new Date().toISOString(),
        link: toastLink || undefined,
        entityType:
          payload.entityType || (payload.type === 'appointment_updated' ? 'appointment' : undefined),
        entityId: payload.entityId ?? payload.appointment?.id,
      };

      const title =
        payload.type === 'appointment_updated'
          ? 'Agenda actualizada'
          : getNotificationTitle(toastNotification);
      const signature = `${normalizedType}:${title}:${description}:${toastNotification.entityId || ''}:${toastLink || ''}`;
      const now = Date.now();

      if (lastToastRef.current && lastToastRef.current.signature === signature && now - lastToastRef.current.at < 1500) {
        return;
      }

      lastToastRef.current = {
        signature,
        at: now,
      };

      antNotification[normalizedType]({
        message: title,
        description,
        placement: 'topRight',
        duration: 5,
        onClick: toastLink ? () => router.push(toastLink) : undefined,
      });
    },
    [router]
  );

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated || !user?.id) {
      resetState();
      return;
    }

    hasLoadedRef.current = false;
    void fetchNotifications();
  }, [fetchNotifications, isAuthenticated, isHydrated, resetState, user?.id]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user?.id) return;
    if (!lastMessage || lastMessage.type !== 'notification') return;

    const payload = normalizeRealtimePayload(lastMessage.notification);
    if (payload) {
      showRealtimeToast(payload);
    }

    const now = Date.now();
    if (now - lastRealtimeRefreshRef.current < 700) return;
    lastRealtimeRefreshRef.current = now;

    void fetchNotifications({ silent: true });
  }, [fetchNotifications, isAuthenticated, isHydrated, lastMessage, showRealtimeToast, user?.id]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user?.id) return;

    if (wsConnected && !previousWsConnectedRef.current && hasLoadedRef.current) {
      void fetchNotifications({ silent: true });
    }

    previousWsConnectedRef.current = wsConnected;
  }, [fetchNotifications, isAuthenticated, isHydrated, user?.id, wsConnected]);

  const contextValue: NotificationContextType = {
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
  };

  return <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return context;
};

export { NotificationContext };
