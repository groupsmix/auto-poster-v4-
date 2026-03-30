// ============================================================
// Structured logging utility for Cloudflare Workers
//
// Outputs JSON-formatted log lines that are compatible with
// Cloudflare Logpush and Workers Trace Events API.
// Each log entry includes a timestamp, level, message, and
// optional structured metadata (requestId, worker, etc.).
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  worker: string;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class StructuredLogger {
  private worker: string;
  private requestId?: string;
  private minLevel: LogLevel;

  constructor(worker: string, options?: { requestId?: string; minLevel?: LogLevel }) {
    this.worker = worker;
    this.requestId = options?.requestId;
    this.minLevel = options?.minLevel ?? "info";
  }

  /** Create a child logger with an attached request ID */
  withRequestId(requestId: string): StructuredLogger {
    return new StructuredLogger(this.worker, {
      requestId,
      minLevel: this.minLevel,
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      worker: this.worker,
      message,
      ...(this.requestId && { requestId: this.requestId }),
      ...meta,
    };

    const line = JSON.stringify(entry);

    switch (level) {
      case "debug":
        console.debug(line);
        break;
      case "info":
        console.log(line);
        break;
      case "warn":
        console.warn(line);
        break;
      case "error":
        console.error(line);
        break;
    }
  }
}
