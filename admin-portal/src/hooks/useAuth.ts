// admin-portal/src/hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { AuthUser, UserRole, LoginResponse } from '@/app/lib/types';
import { apiClient } from '@/app/lib/api';

// Storage keys constants
const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_ROLE: 'userRole',
  USER_ID: 'userID',
  USER_FIRST_NAME: 'userFirstName',
  USER_LAST_NAME: 'userLastName',
  USER_OFFICE_ID: 'userOfficeId',
} as const;

// Cookie configuration
const COOKIE_CONFIG = {
  expires: 1, // 1 day
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (token: string, userData: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

interface AuthQueries {
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isClient: boolean;
}

export const useAuth = (): AuthState & AuthActions & AuthQueries => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  
  const router = useRouter();

  // Storage utilities
  const storage = useMemo(() => ({
    get: (key: string): string | null => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key) || Cookies.get(key) || null;
    },
    set: (key: string, value: string): void => {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, value);
      Cookies.set(key, value, COOKIE_CONFIG);
    },
    remove: (key: string): void => {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(key);
      Cookies.remove(key);
    },
    clear: (): void => {
      if (typeof window === 'undefined') return;
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
        Cookies.remove(key);
      });
    },
  }), []);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
        const role = storage.get(STORAGE_KEYS.USER_ROLE) as UserRole;
        const userId = storage.get(STORAGE_KEYS.USER_ID);
        const firstName = storage.get(STORAGE_KEYS.USER_FIRST_NAME);
        const lastName = storage.get(STORAGE_KEYS.USER_LAST_NAME);

        if (token && role && userId) {
          setState(prev => ({
            ...prev,
            user: {
              id: parseInt(userId, 10),
              role,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
            },
            loading: false,
          }));
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Failed to initialize authentication' 
        }));
      }
    };

    initializeAuth();
  }, [storage]);

  // Actions
  const login = useCallback((token: string, userData: AuthUser) => {
    try {
      // Store auth data
      storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
      storage.set(STORAGE_KEYS.USER_ROLE, userData.role);
      storage.set(STORAGE_KEYS.USER_ID, userData.id.toString());
      if (userData.firstName) storage.set(STORAGE_KEYS.USER_FIRST_NAME, userData.firstName);
      if (userData.lastName) storage.set(STORAGE_KEYS.USER_LAST_NAME, userData.lastName);

      // Update state
      setState(prev => ({
        ...prev,
        user: userData,
        error: null,
      }));
    } catch (error) {
      console.error('Login error:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to store authentication data' 
      }));
    }
  }, [storage]);

  const logout = useCallback(() => {
    try {
      // Clear all auth data
      storage.clear();
      
      // Update state
      setState({
        user: null,
        loading: false,
        error: null,
      });
      
      // Redirect to login
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to logout properly' 
      }));
    }
  }, [storage, router]);

  const refreshUser = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await apiClient.get('/profile');
      const userData: AuthUser = {
        id: parseInt(response.data.userID, 10),
        role: response.data.role,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        email: response.data.email,
      };

      // Update storage with fresh data
      storage.set(STORAGE_KEYS.USER_ROLE, userData.role);
      storage.set(STORAGE_KEYS.USER_ID, userData.id.toString());
      if (userData.firstName) storage.set(STORAGE_KEYS.USER_FIRST_NAME, userData.firstName);
      if (userData.lastName) storage.set(STORAGE_KEYS.USER_LAST_NAME, userData.lastName);
      if (response.data?.officeId) {
        storage.set(STORAGE_KEYS.USER_OFFICE_ID, response.data.officeId.toString());
      }

      setState(prev => ({
        ...prev,
        user: userData,
        loading: false,
        error: null,
      }));
    } catch (error) {
      console.error('User refresh error:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to refresh user data' 
      }));
      
      // If refresh fails, logout
      logout();
    }
  }, [storage, logout]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Computed queries
  const isAuthenticated = useMemo(() => !!state.user, [state.user]);
  
  const hasRole = useCallback((role: UserRole): boolean => {
    return state.user?.role === role;
  }, [state.user]);
  
  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    return state.user ? roles.includes(state.user.role) : false;
  }, [state.user]);
  
  const isAdmin = useMemo(() => hasAnyRole(['admin', 'office_manager']), [hasAnyRole]);
  const isStaff = useMemo(() => hasAnyRole(['staff', 'counselor', 'psychologist']), [hasAnyRole]);
  const isClient = useMemo(() => hasRole('client'), [hasRole]);

  return {
    // State
    user: state.user,
    loading: state.loading,
    error: state.error,
    
    // Actions
    login,
    logout,
    refreshUser,
    clearError,
    
    // Queries
    isAuthenticated,
    hasRole,
    hasAnyRole,
    isAdmin,
    isStaff,
    isClient,
  };
};
