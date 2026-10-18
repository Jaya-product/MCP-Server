import { describe, it, expect } from "vitest";
import {
  redactSecret,
  redactDocId,
  maskEmail,
} from "../../src/utils/logger.js";

describe("Logger Redaction Utilities", () => {
  it("should redact sensitive tokens and passwords", () => {
    const token = "ya29.a0ARrdaM-extremely-long-oauth-access-token-string";
    const redacted = redactSecret(token);

    expect(redacted).not.toBe(token);
    expect(redacted).toContain("[REDACTED]");
    expect(redacted.startsWith("ya2")).toBe(true);
  });

  it("should truncate and redact document IDs preserving first and last 4 characters", () => {
    const docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
    const redacted = redactDocId(docId);

    expect(redacted).toBe("1Bxi...upms");
  });

  it("should mask email user part while preserving domain", () => {
    const email = "jaya.manocha@example.com";
    const masked = maskEmail(email);

    expect(masked).toBe("j***a@example.com");
  });
});
