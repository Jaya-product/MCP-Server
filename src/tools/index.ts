import { GmailService } from "../services/gmail-service.js";
import { DocsService } from "../services/docs-service.js";
import { Config } from "../config.js";
import { createGmailSendEmailHandler } from "./gmail-send-email.js";
import { createGoogleDocsAppendTextHandler } from "./google-docs-append-text.js";
import { MCPToolError } from "../utils/errors.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const GMAIL_SEND_EMAIL_TOOL: ToolDefinition = {
  name: "gmail_send_email",
  description:
    "Sends a plain-text email message from the user's authorized Gmail account. Supports To, optional CC/BCC, subject line, and body. Outbound email is permanent and cannot be undone.",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "array",
        items: { type: "string" },
        description: "List of primary recipient email addresses.",
      },
      cc: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of carbon-copy (CC) email addresses.",
      },
      bcc: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of blind-carbon-copy (BCC) email addresses.",
      },
      subject: {
        type: "string",
        description: "Non-empty email subject line.",
      },
      body: {
        type: "string",
        description: "Plain text email body content.",
      },
      confirm_send: {
        type: "boolean",
        description:
          "Explicit user confirmation flag. Must be true to dispatch email when confirmation policy is active.",
      },
      request_id: {
        type: "string",
        description: "Optional unique caller correlation ID to prevent accidental duplicate sends.",
      },
    },
    required: ["to", "subject", "body"],
  },
};

export const GOOGLE_DOCS_APPEND_TEXT_TOOL: ToolDefinition = {
  name: "google_docs_append_text",
  description:
    "Appends plain text to the very end of an existing Google Doc without modifying, overwriting, or deleting any prior content. Requires an accessible Google Doc ID or URL.",
  inputSchema: {
    type: "object",
    properties: {
      document_id: {
        type: "string",
        description: "The Google Doc ID or full docs.google.com URL of the target document.",
      },
      text: {
        type: "string",
        description: "The exact plain text content to append to the end of the document.",
      },
      prepend_newline: {
        type: "boolean",
        description:
          "Whether to prefix a newline character before the appended text (default: true).",
      },
      request_id: {
        type: "string",
        description: "Optional unique caller correlation ID for traceability.",
      },
    },
    required: ["document_id", "text"],
  },
};

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  GMAIL_SEND_EMAIL_TOOL,
  GOOGLE_DOCS_APPEND_TEXT_TOOL,
];

export function createToolDispatcher(
  gmailService: GmailService,
  docsService: DocsService,
  config: Config
) {
  const gmailHandler = createGmailSendEmailHandler(gmailService, config);
  const docsHandler = createGoogleDocsAppendTextHandler(docsService);

  return async (name: string, args: unknown) => {
    switch (name) {
      case "gmail_send_email":
        return await gmailHandler(args);
      case "google_docs_append_text":
        return await docsHandler(args);
      default:
        throw new MCPToolError(
          "INVALID_ARGUMENT",
          `Unknown tool: '${name}'. Available tools: ${AVAILABLE_TOOLS.map((t) => t.name).join(", ")}`
        );
    }
  };
}
