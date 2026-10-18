import { describe, it, expect } from "vitest";
import {
  GmailSendEmailSchema,
  GoogleDocsAppendTextSchema,
} from "../../src/validation/schemas.js";

describe("GmailSendEmailSchema", () => {
  it("should validate a correct email payload", () => {
    const input = {
      to: ["test@example.com"],
      cc: ["colleague@example.com"],
      subject: "Meeting Followup",
      body: "Here are the notes from our discussion.",
      confirm_send: true,
      request_id: "req-12345",
    };

    const result = GmailSendEmailSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.to).toEqual(["test@example.com"]);
      expect(result.data.cc).toEqual(["colleague@example.com"]);
      expect(result.data.bcc).toEqual([]);
      expect(result.data.confirm_send).toBe(true);
    }
  });

  it("should reject an invalid recipient email address", () => {
    const input = {
      to: ["not-an-email"],
      subject: "Hello",
      body: "Body",
    };

    const result = GmailSendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject an empty recipient list", () => {
    const input = {
      to: [],
      subject: "Hello",
      body: "Body",
    };

    const result = GmailSendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject empty or whitespace-only subject lines", () => {
    const input = {
      to: ["valid@example.com"],
      subject: "   ",
      body: "Body",
    };

    const result = GmailSendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject missing body", () => {
    const input = {
      to: ["valid@example.com"],
      subject: "Subject",
    };

    const result = GmailSendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("GoogleDocsAppendTextSchema", () => {
  it("should validate a valid Google Doc ID", () => {
    const input = {
      document_id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      text: "Appended bullet point.",
      prepend_newline: true,
    };

    const result = GoogleDocsAppendTextSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.document_id).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
      expect(result.data.prepend_newline).toBe(true);
    }
  });

  it("should automatically extract document ID from full Google Docs URL", () => {
    const input = {
      document_id: "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#heading=h.1",
      text: "Action item appended.",
    };

    const result = GoogleDocsAppendTextSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.document_id).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
      expect(result.data.prepend_newline).toBe(true); // default true
    }
  });

  it("should reject malformed document IDs", () => {
    const input = {
      document_id: "short_id",
      text: "Text",
    };

    const result = GoogleDocsAppendTextSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject empty text to append", () => {
    const input = {
      document_id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      text: "",
    };

    const result = GoogleDocsAppendTextSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
