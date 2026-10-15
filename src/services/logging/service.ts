// Structured Logging Service (pino-compatible)
// Provides consistent, parseable logs for production monitoring
// Supports: request logging, audit trails, error tracking, metrics

import { createHash } from 'node:crypto';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
  request_id?: string;
  tenant_id?: number;
  user_id?: number;
  duration_ms?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private logStream: Array<LogEntry> = [];
  private maxLogSize: number = 10000;
  private enabled: boolean = true;

  private constructor() {}

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId(): string {
    return createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 16);
  }

  /**
   * Log at trace level
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context);
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log at error level
   */
  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    const errorContext = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      ...context,
    } : context;
    this.log('error', message, errorContext);
  }

  /**
   * Log at fatal level
   */
  fatal(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.error(message, context, error);
  }

  /**
   * Request-specific logging
   */
  request(req: any, res: any, next: () => void): void {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    // Attach request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    this.info(`[${requestId}] ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'],
      tenant_id: req.tenantId,
      user_id: req.userId,
      request_id: requestId,
    });

    // Log response when complete
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.info(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`, {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        request_id: requestId,
      });
    });

    next();
  }

  /**
   * Log with timing
   */
  async timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.info(`${name} completed`, {
        name,
        duration_ms: Date.now() - start,
      });
      return result;
    } catch (error) {
      this.error(`${name} failed`, {
        name,
        duration_ms: Date.now() - start,
        error,
      });
      throw error;
    }
  }

  /**
   * Get recent logs
   */
  getLogs(limit: number = 100): LogEntry[] {
    return this.logStream.slice(-limit);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, limit: number = 100): LogEntry[] {
    return this.logStream
      .filter(l => l.level === level)
      .slice(-limit);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logStream = [];
  }

  /**
   * Toggle logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get logger statistics
   */
  getStats(): { totalLogs: number; byLevel: Record<string, number> } {
    const byLevel: Record<string, number> = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };

    for (const log of this.logStream) {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
    }

    return {
      totalLogs: this.logStream.length,
      byLevel,
    };
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      context: context || {},
    };

    this.logStream.push(entry);

    // Limit log size
    if (this.logStream.length > this.maxLogSize) {
      this.logStream = this.logStream.slice(-this.maxLogSize / 2);
    }

    // Console output
    const consoleMethod = level === 'error' || level === 'fatal' 
      ? console.error 
      : level === 'warn' 
        ? console.warn 
        : console.log;

    consoleMethod(
      JSON.stringify({
        ts: entry.timestamp,
        level,
        msg: message,
        ...context,
      })
    );
  }
}

// Export singleton
export const logger = StructuredLogger.getInstance();

// Convenience exports
export const { trace, debug, info, warn, error, fatal } = logger;
