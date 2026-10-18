export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "MISSING_CONFIGURATION"
  | "AUTH_REQUIRED"
  | "AUTH_EXPIRED"
  | "INSUFFICIENT_SCOPE"
  | "RESOURCE_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "GOOGLE_API_RATE_LIMIT"
  | "GOOGLE_API_UNAVAILABLE"
  | "REQUEST_TOO_LARGE"
  | "CONFIRMATION_REQUIRED"
  | "DUPLICATE_RISK"
  | "INTERNAL_ERROR";

export interface MCPToolErrorResponse {
  success: false;
  error_code: ErrorCode;
  message: string;
  retryable: boolean;
  request_id?: string;
}

export class MCPToolError extends Error {
  public readonly errorCode: ErrorCode;
  public readonly retryable: boolean;
  public readonly requestId?: string;

  constructor(
    errorCode: ErrorCode,
    message: string,
    options?: { retryable?: boolean; requestId?: string; cause?: unknown }
  ) {
    super(message);
    this.name = "MCPToolError";
    this.errorCode = errorCode;
    this.retryable = options?.retryable ?? false;
    this.requestId = options?.requestId;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  toResponse(): MCPToolErrorResponse {
    return {
      success: false,
      error_code: this.errorCode,
      message: this.message,
      retryable: this.retryable,
      ...(this.requestId ? { request_id: this.requestId } : {}),
    };
  }
}

/**
 * Translates Google API errors and unexpected exceptions into safe, stable MCP errors.
 * Ensures stack traces, raw request headers, and tokens are NEVER exposed.
 */
export function mapToMCPToolError(err: unknown, requestId?: string): MCPToolError {
  if (err instanceof MCPToolError) {
    return err;
  }

  const anyErr = err as Record<string, unknown>;
  const status = anyErr?.status || anyErr?.code;
  const rawMessage = typeof anyErr?.message === "string" ? anyErr.message : "Unknown error occurred";

  // Check common Google API HTTP response codes
  if (status === 401 || rawMessage.includes("invalid_grant") || rawMessage.includes("Invalid Credentials")) {
    return new MCPToolError(
      "AUTH_EXPIRED",
      "Google authentication has expired or was revoked. Please re-authenticate using the auth CLI.",
      { retryable: false, requestId, cause: err }
    );
  }

  if (status === 403) {
    if (rawMessage.includes("insufficientPermissions") || rawMessage.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
      return new MCPToolError(
        "INSUFFICIENT_SCOPE",
        "Google account lacks required permissions/scopes for this action.",
        { retryable: false, requestId, cause: err }
      );
    }
    return new MCPToolError(
      "PERMISSION_DENIED",
      "Permission denied by Google Workspace. Ensure you have edit access to the document or valid Gmail sending rights.",
      { retryable: false, requestId, cause: err }
    );
  }

  if (status === 404) {
    return new MCPToolError(
      "RESOURCE_NOT_FOUND",
      "The requested Google Doc or mailbox resource was not found. Please verify the document ID.",
      { retryable: false, requestId, cause: err }
    );
  }

  if (status === 429 || rawMessage.includes("Quota exceeded") || rawMessage.includes("rateLimitExceeded")) {
    return new MCPToolError(
      "GOOGLE_API_RATE_LIMIT",
      "Google Workspace API rate limit or quota exceeded. Please wait before retrying.",
      { retryable: true, requestId, cause: err }
    );
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return new MCPToolError(
      "GOOGLE_API_UNAVAILABLE",
      "Google Workspace service is temporarily unavailable or returned a server error.",
      { retryable: false, requestId, cause: err } // marked false to avoid duplicate risk on ambiguous response
    );
  }

  return new MCPToolError(
    "INTERNAL_ERROR",
    `Operation failed: ${rawMessage.replace(/([a-zA-Z0-9_-]{20,})/g, "[REDACTED]")}`,
    { retryable: false, requestId, cause: err }
  );
}
