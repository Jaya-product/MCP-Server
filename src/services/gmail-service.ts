import { google } from "googleapis";
import { GoogleOAuthManager } from "../auth/google-oauth.js";
import { Config } from "../config.js";
import {
  GmailSendEmailInput,
  GmailSendEmailResult,
} from "../validation/schemas.js";
import { buildRfc5322Message, toBase64Url } from "../utils/mime.js";
import { logger } from "../utils/logger.js";
import { MCPToolError, mapToMCPToolError } from "../utils/errors.js";

export class GmailService {
  private authManager: GoogleOAuthManager;
  private config: Config;

  constructor(authManager: GoogleOAuthManager, config: Config) {
    this.authManager = authManager;
    this.config = config;
  }

  async sendEmail(input: GmailSendEmailInput): Promise<GmailSendEmailResult> {
    const startTime = Date.now();
    const totalRecipients = input.to.length + (input.cc?.length || 0) + (input.bcc?.length || 0);

    if (totalRecipients > this.config.MAX_EMAIL_RECIPIENTS) {
      throw new MCPToolError(
        "REQUEST_TOO_LARGE",
        `Total recipients count (${totalRecipients}) exceeds configured limit of ${this.config.MAX_EMAIL_RECIPIENTS}.`,
        { requestId: input.request_id }
      );
    }

    const bodyBytes = Buffer.byteLength(input.body, "utf-8");
    if (bodyBytes > this.config.MAX_EMAIL_BODY_BYTES) {
      throw new MCPToolError(
        "REQUEST_TOO_LARGE",
        `Email body size (${bodyBytes} bytes) exceeds configured limit of ${this.config.MAX_EMAIL_BODY_BYTES} bytes.`,
        { requestId: input.request_id }
      );
    }

    try {
      const auth = await this.authManager.getAuthenticatedClient();
      const gmail = google.gmail({ version: "v1", auth });

      // Construct RFC 5322 MIME message
      const mimeString = buildRfc5322Message({
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        body: input.body,
      });

      // Encode as URL-safe Base64
      const rawBase64Url = toBase64Url(mimeString);

      // Execute send request
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: rawBase64Url,
        },
      });

      const messageId = response.data.id || "unknown";
      const threadId = response.data.threadId || undefined;
      const durationMs = Date.now() - startTime;

      logger.info("Successfully sent email via Gmail API", {
        tool: "gmail_send_email",
        request_id: input.request_id,
        duration_ms: durationMs,
        status: "SUCCESS",
        recipient_count: totalRecipients,
        subject_length: input.subject.length,
        body_bytes: bodyBytes,
      });

      return {
        success: true,
        message_id: messageId,
        thread_id: threadId,
        status: "Email sent",
        ...(input.request_id ? { request_id: input.request_id } : {}),
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const mappedError = mapToMCPToolError(err, input.request_id);

      logger.error("Failed to send email via Gmail API", {
        tool: "gmail_send_email",
        request_id: input.request_id,
        duration_ms: durationMs,
        status: "FAILED",
        error_code: mappedError.errorCode,
      });

      throw mappedError;
    }
  }
}
