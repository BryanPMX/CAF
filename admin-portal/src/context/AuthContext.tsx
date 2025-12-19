'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import Cookies from 'js-cookie';
import { AuthUser, UserRole } from '@/app/lib/types';

// Storage keys constants
const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  USER_ROLE: 'userRole',
  USER_OFFICE_ID: 'userOfficeId',
} as const;

// Cookie configuration
const COOKIE_CONFIG = {
  expires: 1, // 1 day
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

// JWT payload interface
interface JWTPayload {
  sub: string; // user ID
  exp: number; // expiration timestamp
  iat: number; // issued at timestamp
}

// Auth state interface
interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// Auth actions interface
interface AuthActions {
  login: (userData: AuthUser, token: string) => void;
  logout: () => void;
  clearError: () => void;
}

// Combined auth context interface
interface AuthContextType extends AuthState, AuthActions {
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isClient: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  
  // State management
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Helper function to decode JWT and extract user data
  const decodeToken = useCallback((token: string): AuthUser | null => {
    try {
      const decoded = jwtDecode<JWTPayload>(token);

      // Check if token is expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp < currentTime) {
        console.warn('Token has expired');
        return null;
      }

      // Extract user data from token
      const userId = parseInt(decoded.sub, 10);
      if (isNaN(userId)) {
        console.error('Invalid user ID in token');
        return null;
      }

      // Return basic user data from token
      // Note: We don't have role/name in JWT, so we'll rely on stored user data
      return {
        id: userId,
        role: 'admin' as UserRole, // This will be overwritten by stored user data
        firstName: undefined,
        lastName: undefined,
      };
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  }, []);

  // Initialize authentication function (shared between useEffects)
  const initializeAuth = useCallback(() => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || Cookies.get(STORAGE_KEYS.AUTH_TOKEN);
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (!token) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
        return;
      }

      // If we have a token but no userData, try to get role from cookie
      let parsedUserData;
      if (userData) {
        parsedUserData = JSON.parse(userData);
      } else {
        const userRole = Cookies.get(STORAGE_KEYS.USER_ROLE);
        if (userRole) {
          // Create minimal user data from token and cookie
          const decodedUser = decodeToken(token);
          if (decodedUser) {
            parsedUserData = {
              id: decodedUser.id,
              role: userRole as UserRole,
              firstName: undefined,
              lastName: undefined,
            };
          }
        }
      }

      if (!parsedUserData) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
        return;
      }

      // Decode token to verify it's still valid
      const decodedUser = decodeToken(token);
      if (!decodedUser) {
        // Invalid or expired token
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
        localStorage.removeItem(STORAGE_KEYS.USER_OFFICE_ID);
        Cookies.remove(STORAGE_KEYS.AUTH_TOKEN);
        Cookies.remove(STORAGE_KEYS.USER_ROLE);
        Cookies.remove(STORAGE_KEYS.USER_OFFICE_ID);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
        return;
      }

      // Set authenticated state using stored data
      setState({
        user: parsedUserData,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });

    } catch (error) {
      console.error('Auth initialization error:', error);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
      localStorage.removeItem(STORAGE_KEYS.USER_OFFICE_ID);
      Cookies.remove(STORAGE_KEYS.AUTH_TOKEN);
      Cookies.remove(STORAGE_KEYS.USER_ROLE);
      Cookies.remove(STORAGE_KEYS.USER_OFFICE_ID);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Authentication initialization failed',
      });
    }
  }, [decodeToken]);
  useEffect(() => {
    // Only run on client side after component mounts
    if (typeof window === 'undefined') return;

    initializeAuth();
  }, []); // Empty dependency - run once after mount, no decodeToken dependency

  // Login function - THE SINGLE AUTHORITATIVE METHOD FOR SETTING AUTH STATE
  const login = useCallback((userData: AuthUser, token: string) => {
    try {
      // CRITICAL: Store both token and user data atomically in localStorage
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      localStorage.setItem(STORAGE_KEYS.USER_ROLE, userData.role); // Store role in localStorage too
      if (userData.officeId) {
        localStorage.setItem(STORAGE_KEYS.USER_OFFICE_ID, userData.officeId.toString());
      }

      // CRITICAL: Also set cookies for server-side middleware access
      Cookies.set(STORAGE_KEYS.AUTH_TOKEN, token, COOKIE_CONFIG);
      Cookies.set(STORAGE_KEYS.USER_ROLE, userData.role, COOKIE_CONFIG);
      if (userData.officeId) {
        Cookies.set(STORAGE_KEYS.USER_OFFICE_ID, userData.officeId.toString(), COOKIE_CONFIG);
      }

      // CRITICAL: Update state immediately and synchronously
      setState({
        user: userData,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });

      // No user feedback here - AuthContext is a silent background service
      // All user feedback is handled by UI components
    } catch (error) {
      console.error('Login error:', error);
      setState(prev => ({
        ...prev,
        error: 'Login failed',
      }));
    }
  }, []);

  // Logout function - SYNCHRONOUS AND ATOMIC
  const logout = useCallback(() => {
    try {
      // CRITICAL: Clear storage atomically
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
      localStorage.removeItem(STORAGE_KEYS.USER_OFFICE_ID);

      // CRITICAL: Also clear cookies
      Cookies.remove(STORAGE_KEYS.AUTH_TOKEN);
      Cookies.remove(STORAGE_KEYS.USER_ROLE);
      Cookies.remove(STORAGE_KEYS.USER_OFFICE_ID);
      
      // CRITICAL: Update state immediately and synchronously
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
      
      // Redirect to login
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({
        ...prev,
        error: 'Logout failed',
      }));
    }
  }, [router]);

  // Clear error function
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Role checking functions
  const hasRole = useCallback((role: UserRole): boolean => {
    return state.user?.role === role;
  }, [state.user]);

  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    return state.user ? roles.includes(state.user.role) : false;
  }, [state.user]);

  // Computed properties
  const isAdmin = hasRole('admin');
  const isStaff = hasAnyRole(['office_manager', 'lawyer', 'psychologist', 'receptionist', 'event_coordinator']);
  const isClient = hasRole('client');

  // Context value
  const contextValue: AuthContextType = {
    // State
    user: state.user,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    error: state.error,
    
    // Actions
    login,
    logout,
    clearError,
    
    // Role checks
    hasRole,
    hasAnyRole,
    isAdmin,
    isStaff,
    isClient,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export the context for advanced usage
export { AuthContext };