import { google } from "googleapis";
import { GoogleOAuthManager } from "../auth/google-oauth.js";
import { Config } from "../config.js";
import {
  GoogleDocsAppendTextInput,
  GoogleDocsAppendTextResult,
} from "../validation/schemas.js";
import { logger } from "../utils/logger.js";
import { MCPToolError, mapToMCPToolError } from "../utils/errors.js";

export class DocsService {
  private authManager: GoogleOAuthManager;
  private config: Config;

  constructor(authManager: GoogleOAuthManager, config: Config) {
    this.authManager = authManager;
    this.config = config;
  }

  async appendText(input: GoogleDocsAppendTextInput): Promise<GoogleDocsAppendTextResult> {
    const startTime = Date.now();
    const textBytes = Buffer.byteLength(input.text, "utf-8");

    if (textBytes > this.config.MAX_DOC_APPEND_BYTES) {
      throw new MCPToolError(
        "REQUEST_TOO_LARGE",
        `Append text payload (${textBytes} bytes) exceeds configured limit of ${this.config.MAX_DOC_APPEND_BYTES} bytes.`,
        { requestId: input.request_id }
      );
    }

    try {
      const auth = await this.authManager.getAuthenticatedClient();
      const docs = google.docs({ version: "v1", auth });

      // Determine text to append with optional leading newline
      const textToInsert = input.prepend_newline ? `\n${input.text}` : input.text;

      // Google Docs API endOfSegmentLocation guarantees appending to the very end
      // without modifying, replacing, or deleting any existing text.
      await docs.documents.batchUpdate({
        documentId: input.document_id,
        requestBody: {
          requests: [
            {
              insertText: {
                endOfSegmentLocation: {
                  segmentId: "", // Empty string refers to the document body segment
                },
                text: textToInsert,
              },
            },
          ],
        },
      });

      const durationMs = Date.now() - startTime;
      const charactersAppended = textToInsert.length;

      logger.info("Successfully appended text to Google Doc", {
        tool: "google_docs_append_text",
        request_id: input.request_id,
        duration_ms: durationMs,
        status: "SUCCESS",
        doc_id: input.document_id,
        characters_appended: charactersAppended,
      });

      return {
        success: true,
        document_id: input.document_id,
        status: "Text appended to Google Doc",
        characters_appended: charactersAppended,
        ...(input.request_id ? { request_id: input.request_id } : {}),
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const mappedError = mapToMCPToolError(err, input.request_id);

      logger.error("Failed to append text to Google Doc", {
        tool: "google_docs_append_text",
        request_id: input.request_id,
        duration_ms: durationMs,
        status: "FAILED",
        error_code: mappedError.errorCode,
        doc_id: input.document_id,
      });

      throw mappedError;
    }
  }
}
