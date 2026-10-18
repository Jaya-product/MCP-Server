import { z } from "zod";

// Standard RFC 5322 simplified email regex validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Google Docs IDs are alphanumeric characters, dashes, and underscores (typically ~44 chars)
const GOOGLE_DOC_ID_REGEX = /^[a-zA-Z0-9-_]{20,100}$/;

export const GmailSendEmailSchema = z.object({
  to: z
    .array(
      z
        .string()
        .trim()
        .regex(EMAIL_REGEX, "Invalid email address format")
        .max(320, "Email address exceeds maximum length of 320 characters")
    )
    .min(1, "At least one recipient is required in 'to'")
    .max(50, "Exceeded maximum allowed recipients in 'to' (limit: 50)"),
  cc: z
    .array(
      z
        .string()
        .trim()
        .regex(EMAIL_REGEX, "Invalid CC email address format")
        .max(320)
    )
    .max(50, "Exceeded maximum allowed recipients in 'cc' (limit: 50)")
    .optional()
    .default([]),
  bcc: z
    .array(
      z
        .string()
        .trim()
        .regex(EMAIL_REGEX, "Invalid BCC email address format")
        .max(320)
    )
    .max(50, "Exceeded maximum allowed recipients in 'bcc' (limit: 50)")
    .optional()
    .default([]),
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(1, "Subject line cannot be empty or whitespace only")
    .max(500, "Subject line exceeds maximum limit of 500 characters"),
  body: z
    .string({ required_error: "Body is required" })
    .min(1, "Email body cannot be empty")
    .max(1_000_000, "Email body exceeds maximum size of 1MB"),
  confirm_send: z
    .boolean()
    .optional()
    .describe("Explicit confirmation flag. Required when REQUIRE_EMAIL_CONFIRMATION=true."),
  request_id: z
    .string()
    .optional()
    .describe("Optional caller-supplied idempotency/correlation identifier for duplicate tracking."),
});

export type GmailSendEmailInput = z.infer<typeof GmailSendEmailSchema>;

export const GoogleDocsAppendTextSchema = z.object({
  document_id: z
    .string({ required_error: "document_id is required" })
    .trim()
    .transform((val) => {
      // Automatic extraction if full URL is provided: https://docs.google.com/document/d/<ID>/edit
      const urlMatch = val.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return urlMatch ? urlMatch[1] : val;
    })
    .pipe(z.string().regex(GOOGLE_DOC_ID_REGEX, "Invalid Google Docs document ID format")),
  text: z
    .string({ required_error: "text is required" })
    .min(1, "Append text cannot be empty")
    .max(500_000, "Append text exceeds maximum limit of 500KB per request"),
  prepend_newline: z
    .boolean()
    .default(true)
    .describe("Whether to insert a newline separator before the appended text if the document does not end with one."),
  request_id: z
    .string()
    .optional()
    .describe("Optional caller-supplied idempotency/correlation identifier."),
});

export type GoogleDocsAppendTextInput = z.infer<typeof GoogleDocsAppendTextSchema>;

export interface GmailSendEmailResult {
  success: true;
  message_id: string;
  thread_id?: string;
  status: string;
  request_id?: string;
}

export interface GoogleDocsAppendTextResult {
  success: true;
  document_id: string;
  status: string;
  characters_appended: number;
  request_id?: string;
}
