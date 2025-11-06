// admin-portal/src/core/logger.ts

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
}

// Logger Class with consistent formatting
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${levelName}: ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, error);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, error);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, error);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, error);
        break;
    }

    // In production, you might want to send logs to a service
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService({
        level,
        message,
        timestamp: new Date(),
        context,
        error,
      });
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // API-specific logging methods
  apiRequest(method: string, url: string, data?: any): void {
    this.debug(`API Request: ${method} ${url}`, { data });
  }

  apiResponse(method: string, url: string, status: number, duration: number): void {
    const level = status >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(level, `API Response: ${method} ${url} - ${status}`, {
      status,
      duration: `${duration}ms`
    });
  }

  apiError(method: string, url: string, error: any): void {
    this.error(`API Error: ${method} ${url}`, { error: error.message }, error);
  }

  // Business logic logging
  businessEvent(event: string, context?: Record<string, any>): void {
    this.info(`Business Event: ${event}`, context);
  }

  userAction(action: string, userId: string, context?: Record<string, any>): void {
    this.info(`User Action: ${action}`, { userId, ...context });
  }

  private sendToLoggingService(entry: LogEntry): void {
    // In a real application, this would send logs to a logging service
    // like DataDog, LogRocket, Sentry, etc.
    try {
      // Example: send to a logging endpoint
      // fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry),
      // });
    } catch (error) {
      console.error('Failed to send log to service:', error);
    }
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Convenience functions
export const log = {
  debug: (message: string, context?: Record<string, any>) => logger.debug(message, context),
  info: (message: string, context?: Record<string, any>) => logger.info(message, context),
  warn: (message: string, context?: Record<string, any>, error?: Error) => logger.warn(message, context, error),
  error: (message: string, context?: Record<string, any>, error?: Error) => logger.error(message, context, error),
  apiRequest: (method: string, url: string, data?: any) => logger.apiRequest(method, url, data),
  apiResponse: (method: string, url: string, status: number, duration: number) => logger.apiResponse(method, url, status, duration),
  businessEvent: (event: string, context?: Record<string, any>) => logger.businessEvent(event, context),
  userAction: (action: string, userId: string, context?: Record<string, any>) => logger.userAction(action, userId, context),
};
