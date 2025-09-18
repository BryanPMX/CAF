// marketing/src/lib/utils/errorHandler.js
// Centralized error handling utilities for the marketing site

export class ErrorHandler {
  constructor() {
    this.errorLog = [];
  }

  // Handle different types of errors
  handleError(error, context = '') {
    const errorInfo = {
      message: error.message || 'An unexpected error occurred',
      type: this.getErrorType(error),
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    // Log error for debugging
    console.error('Error occurred:', errorInfo);
    
    // Store error for potential reporting
    this.errorLog.push(errorInfo);
    
    // Show user-friendly message
    this.showUserMessage(errorInfo);
    
    return errorInfo;
  }

  // Categorize error types
  getErrorType(error) {
    if (error.name === 'TypeError') return 'type_error';
    if (error.name === 'ReferenceError') return 'reference_error';
    if (error.name === 'NetworkError') return 'network_error';
    if (error.message?.includes('fetch')) return 'api_error';
    if (error.message?.includes('timeout')) return 'timeout_error';
    return 'unknown_error';
  }

  // Show user-friendly error messages
  showUserMessage(errorInfo) {
    const messages = {
      network_error: 'Parece que hay un problema de conexión. Por favor, verifique su internet e intente nuevamente.',
      api_error: 'No pudimos conectar con nuestros servidores. Por favor, intente más tarde.',
      timeout_error: 'La solicitud está tardando más de lo esperado. Por favor, intente nuevamente.',
      type_error: 'Ocurrió un error inesperado. Por favor, recargue la página.',
      reference_error: 'Ocurrió un error de configuración. Por favor, contacte al soporte técnico.',
      unknown_error: 'Ocurrió un error inesperado. Por favor, intente nuevamente o contacte al soporte técnico.'
    };

    const message = messages[errorInfo.type] || messages.unknown_error;
    
    // Create and show error notification
    this.showNotification(message, 'error');
  }

  // Show notification to user
  showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.error-notification');
    if (existing) existing.remove();

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `error-notification error-notification--${type}`;
    notification.innerHTML = `
      <div class="error-notification__content">
        <div class="error-notification__icon">
          ${type === 'error' ? '⚠️' : 'ℹ️'}
        </div>
        <div class="error-notification__message">${message}</div>
        <button class="error-notification__close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#fee' : '#e6f3ff'};
      border: 1px solid ${type === 'error' ? '#fcc' : '#b3d9ff'};
      border-radius: 8px;
      padding: 16px;
      max-width: 400px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .error-notification__content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .error-notification__icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      .error-notification__message {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
        color: #333;
      }
      .error-notification__close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .error-notification__close:hover {
        color: #333;
      }
    `;
    document.head.appendChild(style);

    // Add to page
    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Handle API errors specifically
  handleApiError(error, endpoint = '') {
    const errorInfo = {
      message: error.message || 'API request failed',
      type: 'api_error',
      context: `API endpoint: ${endpoint}`,
      timestamp: new Date().toISOString(),
      status: error.status || 'unknown',
      response: error.response || null
    };

    console.error('API Error:', errorInfo);
    this.errorLog.push(errorInfo);

    // Show appropriate message based on status
    let message;
    if (error.status === 404) {
      message = 'El recurso solicitado no fue encontrado.';
    } else if (error.status === 500) {
      message = 'Error interno del servidor. Por favor, intente más tarde.';
    } else if (error.status === 403) {
      message = 'No tiene permisos para acceder a este recurso.';
    } else if (error.status >= 400 && error.status < 500) {
      message = 'Error en la solicitud. Por favor, verifique los datos e intente nuevamente.';
    } else {
      message = 'No pudimos conectar con nuestros servidores. Por favor, intente más tarde.';
    }

    this.showNotification(message, 'error');
    return errorInfo;
  }

  // Get error log for debugging
  getErrorLog() {
    return this.errorLog;
  }

  // Clear error log
  clearErrorLog() {
    this.errorLog = [];
  }
}

// Create global error handler instance
export const errorHandler = new ErrorHandler();

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorHandler.handleError(event.error, 'global_error_handler');
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.handleError(new Error(event.reason), 'unhandled_promise_rejection');
  });
}
