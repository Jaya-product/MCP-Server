import { describe, it, expect } from "vitest";
import { MCPToolError, mapToMCPToolError } from "../../src/utils/errors.js";

describe("Error Taxonomy and Mapping", () => {
  it("should format MCPToolError to standard structured error response", () => {
    const error = new MCPToolError("CONFIRMATION_REQUIRED", "Confirmation needed.", {
      requestId: "req-abc",
    });

    const response = error.toResponse();
    expect(response).toEqual({
      success: false,
      error_code: "CONFIRMATION_REQUIRED",
      message: "Confirmation needed.",
      retryable: false,
      request_id: "req-abc",
    });
  });

  it("should map Google 401 error to AUTH_EXPIRED", () => {
    const googleError = { status: 401, message: "Invalid Credentials" };
    const mapped = mapToMCPToolError(googleError, "req-1");

    expect(mapped.errorCode).toBe("AUTH_EXPIRED");
    expect(mapped.retryable).toBe(false);
  });

  it("should map Google 403 insufficientPermissions to INSUFFICIENT_SCOPE", () => {
    const googleError = {
      status: 403,
      message: "Request had insufficient authentication scopes: ACCESS_TOKEN_SCOPE_INSUFFICIENT",
    };
    const mapped = mapToMCPToolError(googleError, "req-2");

    expect(mapped.errorCode).toBe("INSUFFICIENT_SCOPE");
  });

  it("should map Google 404 to RESOURCE_NOT_FOUND", () => {
    const googleError = { status: 404, message: "File not found: 1BxiM..." };
    const mapped = mapToMCPToolError(googleError);

    expect(mapped.errorCode).toBe("RESOURCE_NOT_FOUND");
  });

  it("should map Google 429 quota error to GOOGLE_API_RATE_LIMIT with retryable: true", () => {
    const googleError = { status: 429, message: "Rate limit exceeded" };
    const mapped = mapToMCPToolError(googleError);

    expect(mapped.errorCode).toBe("GOOGLE_API_RATE_LIMIT");
    expect(mapped.retryable).toBe(true);
  });
});
