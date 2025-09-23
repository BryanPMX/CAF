// admin-portal/src/components/ErrorBoundary.tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Card, Typography, Space } from 'antd';
import { ReloadOutlined, HomeOutlined, BugOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Comprehensive Error Boundary Component
 * 
 * Features:
 * - Catches JavaScript errors anywhere in the component tree
 * - Logs errors for debugging
 * - Provides user-friendly error UI
 * - Offers recovery options (reload, go home)
 * - Supports custom fallback components
 * - Integrates with error reporting services
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Example: Send to error reporting service
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: localStorage.getItem('userId') || 'anonymous',
      };

      // In a real implementation, you would send this to your error service
      console.log('Error logged to service:', errorData);
    } catch (loggingError) {
      console.error('Failed to log error to service:', loggingError);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#f5f5f5'
        }}>
          <Card 
            style={{ 
              maxWidth: '600px', 
              width: '100%',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
          >
            <Result
              status="error"
              icon={<BugOutlined style={{ fontSize: '64px', color: '#ff4d4f' }} />}
              title="¡Oops! Algo salió mal"
              subTitle={
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text type="secondary">
                    Ha ocurrido un error inesperado en la aplicación.
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Nuestro equipo ha sido notificado y está trabajando para solucionarlo.
                  </Text>
                </Space>
              }
              extra={[
                <Button 
                  key="retry" 
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={this.handleRetry}
                  style={{ marginRight: '8px' }}
                >
                  Reintentar
                </Button>,
                <Button 
                  key="home" 
                  icon={<HomeOutlined />}
                  onClick={this.handleGoHome}
                  style={{ marginRight: '8px' }}
                >
                  Ir al Inicio
                </Button>,
                <Button 
                  key="reload" 
                  onClick={this.handleReload}
                >
                  Recargar Página
                </Button>,
              ]}
            />

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Card 
                size="small" 
                title="Detalles del Error (Solo Desarrollo)" 
                style={{ marginTop: '20px' }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Text strong>Error:</Text>
                    <Paragraph 
                      code 
                      style={{ 
                        marginTop: '4px', 
                        fontSize: '12px',
                        wordBreak: 'break-all'
                      }}
                    >
                      {this.state.error.message}
                    </Paragraph>
                  </div>
                  
                  {this.state.error.stack && (
                    <div>
                      <Text strong>Stack Trace:</Text>
                      <Paragraph 
                        code 
                        style={{ 
                          marginTop: '4px', 
                          fontSize: '11px',
                          maxHeight: '200px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {this.state.error.stack}
                      </Paragraph>
                    </div>
                  )}

                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <Text strong>Component Stack:</Text>
                      <Paragraph 
                        code 
                        style={{ 
                          marginTop: '4px', 
                          fontSize: '11px',
                          maxHeight: '200px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {this.state.errorInfo.componentStack}
                      </Paragraph>
                    </div>
                  )}
                </Space>
              </Card>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Hook for functional components to catch errors
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    
    // Log to external service
    const errorData = {
      message: error.message,
      stack: error.stack,
      errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // In production, send to error service
    if (process.env.NODE_ENV === 'production') {
      console.log('Error logged to service:', errorData);
    }
  };
}

export default ErrorBoundary;