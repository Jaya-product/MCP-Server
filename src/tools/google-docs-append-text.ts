import { DocsService } from "../services/docs-service.js";
import { GoogleDocsAppendTextSchema } from "../validation/schemas.js";
import { MCPToolError } from "../utils/errors.js";

export function createGoogleDocsAppendTextHandler(docsService: DocsService) {
  return async (args: unknown) => {
    // Validate input arguments against Zod schema
    const parseResult = GoogleDocsAppendTextSchema.safeParse(args);
    if (!parseResult.success) {
      const details = parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new MCPToolError("INVALID_ARGUMENT", `Invalid document append arguments: ${details}`);
    }

    const input = parseResult.data;
    const result = await docsService.appendText(input);

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
