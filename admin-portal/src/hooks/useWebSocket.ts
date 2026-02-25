'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface WebSocketMessage {
  type: string;
  notification?: any;
  [key: string]: any;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;

function buildWebSocketUrl(apiBaseUrl: string, token: string): string | null {
  try {
    const apiUrl = new URL(apiBaseUrl);
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    let path = apiUrl.pathname.replace(/\/+$/, '');
    path = path.replace(/\/api\/v1$/, '');
    path = path ? `${path}/ws` : '/ws';

    const wsUrl = new URL(`${protocol}//${apiUrl.host}${path}`);
    wsUrl.searchParams.set('token', token);
    return wsUrl.toString();
  } catch (error) {
    console.error('Invalid NEXT_PUBLIC_API_URL for WebSocket:', error);
    return null;
  }
}

export const useWebSocket = (): UseWebSocketReturn => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const manualCloseRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    clearReconnectTimer();

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Disconnect requested');
      } catch {
        // no-op
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, [clearReconnectTimer]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return;

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) return;

    const wsUrl = buildWebSocketUrl(apiBase, token);
    if (!wsUrl) return;

    clearReconnectTimer();

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Reconnecting');
      } catch {
        // no-op
      }
      wsRef.current = null;
    }

    manualCloseRef.current = false;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(parsed);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        if (manualCloseRef.current) return;
        if (event.code === 1000) return;
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;

        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [clearReconnectTimer, user]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
  };
};
