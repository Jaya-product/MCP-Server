import { describe, it, expect } from "vitest";
import { AVAILABLE_TOOLS, GMAIL_SEND_EMAIL_TOOL, GOOGLE_DOCS_APPEND_TEXT_TOOL } from "../../src/tools/index.js";

describe("MCP Protocol and Tool Definitions", () => {
  it("should publish both tools with valid JSON Schemas", () => {
    expect(AVAILABLE_TOOLS).toHaveLength(2);
    expect(AVAILABLE_TOOLS).toContain(GMAIL_SEND_EMAIL_TOOL);
    expect(AVAILABLE_TOOLS).toContain(GOOGLE_DOCS_APPEND_TEXT_TOOL);
  });

  it("should define correct parameters for gmail_send_email", () => {
    expect(GMAIL_SEND_EMAIL_TOOL.name).toBe("gmail_send_email");
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.required).toEqual(["to", "subject", "body"]);
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.properties).toHaveProperty("to");
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.properties).toHaveProperty("cc");
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.properties).toHaveProperty("bcc");
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.properties).toHaveProperty("subject");
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.properties).toHaveProperty("body");
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.properties).toHaveProperty("confirm_send");
    expect(GMAIL_SEND_EMAIL_TOOL.inputSchema.properties).toHaveProperty("request_id");
  });

  it("should define correct parameters for google_docs_append_text", () => {
    expect(GOOGLE_DOCS_APPEND_TEXT_TOOL.name).toBe("google_docs_append_text");
    expect(GOOGLE_DOCS_APPEND_TEXT_TOOL.inputSchema.required).toEqual(["document_id", "text"]);
    expect(GOOGLE_DOCS_APPEND_TEXT_TOOL.inputSchema.properties).toHaveProperty("document_id");
    expect(GOOGLE_DOCS_APPEND_TEXT_TOOL.inputSchema.properties).toHaveProperty("text");
    expect(GOOGLE_DOCS_APPEND_TEXT_TOOL.inputSchema.properties).toHaveProperty("prepend_newline");
    expect(GOOGLE_DOCS_APPEND_TEXT_TOOL.inputSchema.properties).toHaveProperty("request_id");
  });
});
