// admin-portal/src/core/errors.ts

// Custom Error Classes for better error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

// Error Handler Utility
export class ErrorHandler {
  static handle(error: unknown): never {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof ValidationError) {
      throw error;
    }

    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      throw error;
    }

    // Handle axios errors
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as any;
      const statusCode = axiosError.response?.status;
      const responseData = axiosError.response?.data;

      switch (statusCode) {
        case 400:
          throw new ValidationError(responseData?.message || 'Bad request');
        case 401:
          throw new AuthenticationError('Session expired');
        case 403:
          throw new AuthorizationError('Access denied');
        case 404:
          throw new ApiError('Resource not found', 404);
        case 422:
          throw new ValidationError(responseData?.message || 'Validation failed');
        case 500:
          throw new ApiError('Internal server error', 500);
        default:
          throw new ApiError(responseData?.message || 'Unknown error', statusCode);
      }
    }

    // Handle network errors
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const networkError = error as any;
      if (networkError.code === 'NETWORK_ERROR') {
        throw new NetworkError();
      }
    }

    // Default error
    throw new ApiError('An unexpected error occurred');
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }

  static isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
  }

  static isAuthenticationError(error: unknown): error is AuthenticationError {
    return error instanceof AuthenticationError;
  }

  static isAuthorizationError(error: unknown): error is AuthorizationError {
    return error instanceof AuthorizationError;
  }

  static isNetworkError(error: unknown): error is NetworkError {
    return error instanceof NetworkError;
  }
}

// Async operation wrapper with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (errorMessage) {
      console.error(`${errorMessage}:`, error);
    }
    ErrorHandler.handle(error);
  }
}
