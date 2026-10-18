import { GmailService } from "../services/gmail-service.js";
import { Config } from "../config.js";
import { GmailSendEmailSchema } from "../validation/schemas.js";
import { MCPToolError } from "../utils/errors.js";

export function createGmailSendEmailHandler(
  gmailService: GmailService,
  config: Config
) {
  return async (args: unknown) => {
    // Validate input arguments against Zod schema
    const parseResult = GmailSendEmailSchema.safeParse(args);
    if (!parseResult.success) {
      const details = parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new MCPToolError("INVALID_ARGUMENT", `Invalid email arguments: ${details}`);
    }

    const input = parseResult.data;

    // Enforce confirmation policy if enabled
    if (config.REQUIRE_EMAIL_CONFIRMATION && input.confirm_send !== true) {
      const recipientSummary = input.to.join(", ");
      throw new MCPToolError(
        "CONFIRMATION_REQUIRED",
        `Email confirmation required before sending. Recipient(s): [${recipientSummary}], Subject: "${input.subject}". Prompt the user for confirmation and re-invoke this tool with confirm_send: true.`,
        { requestId: input.request_id }
      );
    }

    const result = await gmailService.sendEmail(input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  };
}
