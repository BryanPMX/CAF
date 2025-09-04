// Logger service to replace console statements
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];

  private formatMessage(level: LogLevel, message: string, context?: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data
    };

    this.logs.push(logEntry);

    // In development, log to console
    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage(level, message, context, data);
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }

    // In production, you could send logs to a logging service
    // this.sendToLoggingService(logEntry);
  }

  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  // Get logs for debugging purposes
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }
}

// Create a singleton instance
export const logger = new Logger();

// Error handling utility
export const handleApiError = (error: any, context: string): string => {
  let errorMessage = 'An unexpected error occurred';
  
  if (error?.response?.data?.error) {
    errorMessage = error.response.data.error;
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  logger.error(`API Error in ${context}: ${errorMessage}`, context, error);
  return errorMessage;
};

// Success logging utility
export const logApiSuccess = (message: string, context: string, data?: any): void => {
  logger.info(`API Success in ${context}: ${message}`, context, data);
};
