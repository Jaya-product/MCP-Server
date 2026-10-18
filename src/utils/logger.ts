export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLogLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Masks sensitive authentication strings, tokens, and secrets.
 */
export function redactSecret(secret: string | undefined | null): string {
  if (!secret) return "";
  if (secret.length <= 8) return "[REDACTED]";
  return `${secret.substring(0, 3)}...[REDACTED]...${secret.substring(secret.length - 3)}`;
}

/**
 * Truncates document IDs for safe logging without full disclosure.
 */
export function redactDocId(docId: string | undefined | null): string {
  if (!docId) return "";
  if (docId.length <= 8) return "[REDACTED_ID]";
  return `${docId.substring(0, 4)}...${docId.substring(docId.length - 4)}`;
}

/**
 * Masks recipient email addresses for privacy (e.g., j***@domain.com).
 */
export function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "[REDACTED_EMAIL]";
  const [user, domain] = parts;
  const maskedUser = user.length <= 2 ? `${user[0]}*` : `${user[0]}***${user[user.length - 1]}`;
  return `${maskedUser}@${domain}`;
}

export interface StructuredLogMeta {
  tool?: string;
  request_id?: string;
  duration_ms?: number;
  status?: string;
  error_code?: string;
  recipient_count?: number;
  subject_length?: number;
  body_bytes?: number;
  doc_id?: string;
  characters_appended?: number;
  [key: string]: unknown;
}

class RedactingLogger {
  private log(level: LogLevel, message: string, meta?: StructuredLogMeta): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[currentLogLevel]) {
      return;
    }

    const sanitizedMeta: Record<string, unknown> = meta ? { ...meta } : {};

    // Remove any accidental secret/body leakage
    delete sanitizedMeta.body;
    delete sanitizedMeta.text;
    delete sanitizedMeta.access_token;
    delete sanitizedMeta.refresh_token;
    delete sanitizedMeta.client_secret;

    if (typeof sanitizedMeta.doc_id === "string") {
      sanitizedMeta.doc_id = redactDocId(sanitizedMeta.doc_id);
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...sanitizedMeta,
    };

    // CRITICAL: Always write to stderr so stdio JSON-RPC transport remains unbroken.
    process.stderr.write(`${JSON.stringify(payload)}\n`);
  }

  debug(message: string, meta?: StructuredLogMeta): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: StructuredLogMeta): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: StructuredLogMeta): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: StructuredLogMeta): void {
    this.log("error", message, meta);
  }
}

export const logger = new RedactingLogger();
