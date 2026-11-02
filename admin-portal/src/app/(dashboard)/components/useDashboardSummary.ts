'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/app/lib/api';

export interface DashboardOffice {
  id: number;
  name: string;
}

export interface DashboardSummary {
  totalCases: number;
  openCases: number;
  completedCases: number;
  casesThisMonth: number;
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  appointmentsToday: number;
  appointmentsThisWeek: number;
  totalStaff: number;
  totalClients: number;
  pendingTasks: number;
  myCases: number;
  myOpenCases: number;
  myCompletedCases: number;
  myAppointments: number;
  myPendingAppointments: number;
  myAppointmentsToday: number;
  myPendingTasks: number;
}

interface UseDashboardSummaryOptions {
  enabled: boolean;
  role: string | undefined;
  userOfficeId?: number | null;
}

interface RefreshOptions {
  background?: boolean;
  officeId?: string;
}

const EMPTY_SUMMARY: DashboardSummary = {
  totalCases: 0,
  openCases: 0,
  completedCases: 0,
  casesThisMonth: 0,
  totalAppointments: 0,
  pendingAppointments: 0,
  completedAppointments: 0,
  appointmentsToday: 0,
  appointmentsThisWeek: 0,
  totalStaff: 0,
  totalClients: 0,
  pendingTasks: 0,
  myCases: 0,
  myOpenCases: 0,
  myCompletedCases: 0,
  myAppointments: 0,
  myPendingAppointments: 0,
  myAppointmentsToday: 0,
  myPendingTasks: 0,
};

const MANAGEMENT_ROLES = new Set(['admin', 'office_manager']);
const SUPPORTED_ROLES = new Set([
  ...MANAGEMENT_ROLES,
  'lawyer',
  'psychologist',
  'receptionist',
  'event_coordinator',
]);

function toCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function normalizeSummary(payload: unknown): DashboardSummary {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};

  return Object.keys(EMPTY_SUMMARY).reduce<DashboardSummary>((summary, key) => {
    const field = key as keyof DashboardSummary;
    summary[field] = toCount(source[field]);
    return summary;
  }, { ...EMPTY_SUMMARY });
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }

  return 'No fue posible cargar los indicadores del panel. Intente nuevamente.';
}

export function isDashboardStaffRole(role: string | undefined): boolean {
  return Boolean(role && SUPPORTED_ROLES.has(role) && !MANAGEMENT_ROLES.has(role));
}

export function useDashboardSummary({ enabled, role, userOfficeId }: UseDashboardSummaryOptions) {
  const initialOfficeId = role === 'office_manager' && userOfficeId ? String(userOfficeId) : '';
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [offices, setOffices] = useState<DashboardOffice[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState(initialOfficeId);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setSelectedOfficeId(initialOfficeId);
  }, [initialOfficeId]);

  useEffect(() => {
    if (!enabled || !role || !MANAGEMENT_ROLES.has(role)) {
      setOffices([]);
      return;
    }

    let active = true;
    apiClient.get<DashboardOffice[]>('/offices')
      .then((response) => {
        if (!active) return;
        setOffices(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (active) setOffices([]);
      });

    return () => {
      active = false;
    };
  }, [enabled, role]);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (!enabled || !role || !SUPPORTED_ROLES.has(role)) return;

    const requestId = ++requestIdRef.current;
    const background = Boolean(options.background || hasLoadedRef.current);
    const officeId = options.officeId ?? selectedOfficeId;

    if (background) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const isManagement = MANAGEMENT_ROLES.has(role);
      const response = await apiClient.get(
        isManagement ? '/dashboard-summary' : '/staff/dashboard-summary',
        isManagement && officeId ? { params: { officeId } } : undefined
      );

      if (requestId !== requestIdRef.current) return;
      setSummary(normalizeSummary(response.data));
      hasLoadedRef.current = true;
      setLastUpdatedAt(Date.now());
    } catch (refreshError) {
      if (requestId !== requestIdRef.current) return;
      setError(getErrorMessage(refreshError));
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled, role, selectedOfficeId]);

  useEffect(() => {
    if (!enabled || !role) return;
    void refresh({ officeId: selectedOfficeId });
  }, [enabled, refresh, role, selectedOfficeId]);

  useEffect(() => {
    if (!enabled || !role || !summary) return;
    const timer = window.setInterval(() => {
      void refresh({ background: true });
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [enabled, refresh, role, summary]);

  const selectOffice = useCallback((officeId: string | undefined) => {
    setSelectedOfficeId(officeId ?? '');
  }, []);

  return {
    summary,
    offices,
    selectedOfficeId,
    selectOffice,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
  };
}
