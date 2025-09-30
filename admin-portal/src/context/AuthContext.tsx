'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { message } from 'antd';
import { AuthUser, UserRole, LoginResponse } from '@/app/lib/types';
import { apiClient } from '@/app/lib/api';

// Storage keys constants
const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
} as const;

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
  login: (token: string, userData: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
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

      // For now, we'll need to fetch user details from the API
      // since the JWT only contains the user ID
      return {
        id: userId,
        role: 'admin' as UserRole, // This will be updated when we fetch user details
        firstName: undefined,
        lastName: undefined,
      };
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  }, []);

  // Fetch user details from API
  const fetchUserDetails = useCallback(async (userId: number): Promise<AuthUser | null> => {
    try {
      const response = await apiClient.get(`/admin/users/${userId}`);
      // Backend returns: { user: {...}, office: {...}, caseAssignments: [...] }
      // We need to extract the user object from the response
      const userData = response.data.user || response.data.data || response.data;
      
      return {
        id: userData.id,
        role: userData.role,
        firstName: userData.firstName,
        lastName: userData.lastName,
      };
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      return null;
    }
  }, []);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        
        if (!token || !userData) {
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
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: null,
          });
          return;
        }

        // Parse stored user data
        const parsedUserData = JSON.parse(userData);
        
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
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: 'Authentication initialization failed',
        });
      }
    };

    initializeAuth();
  }, [decodeToken]);

  // Login function
  const login = useCallback((token: string, userData: AuthUser) => {
    try {
      // Store token and user data
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      
      // Update state
      setState({
        user: userData,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });

      message.success('¡Bienvenido al Sistema CAF!');
    } catch (error) {
      console.error('Login error:', error);
      setState(prev => ({
        ...prev,
        error: 'Login failed',
      }));
      message.error('Error al iniciar sesión');
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    try {
      // Clear storage
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      
      // Update state
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
      
      // Redirect to login
      router.replace('/login');
      message.success('Sesión cerrada exitosamente');
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({
        ...prev,
        error: 'Logout failed',
      }));
    }
  }, [router]);

  // Refresh user function
  const refreshUser = useCallback(async () => {
    if (!state.user) return;

    try {
      const userDetails = await fetchUserDetails(state.user.id);
      if (userDetails) {
        setState(prev => ({
          ...prev,
          user: userDetails,
          error: null,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to refresh user',
      }));
    }
  }, [state.user, fetchUserDetails]);

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
    refreshUser,
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
