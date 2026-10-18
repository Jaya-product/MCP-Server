import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Config } from "./config.js";
import { GoogleOAuthManager } from "./auth/google-oauth.js";
import { GmailService } from "./services/gmail-service.js";
import { DocsService } from "./services/docs-service.js";
import { AVAILABLE_TOOLS, createToolDispatcher } from "./tools/index.js";
import { MCPToolError, mapToMCPToolError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";

export function createMcpServer(config: Config): Server {
  const server = new Server(
    {
      name: "google-workspace-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const authManager = new GoogleOAuthManager(config);
  const gmailService = new GmailService(authManager, config);
  const docsService = new DocsService(authManager, config);
  const dispatcher = createToolDispatcher(gmailService, docsService, config);

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Received tools/list request");
    return {
      tools: AVAILABLE_TOOLS,
    };
  });

  // Call a tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Received tools/call request for '${name}'`, { tool: name });

    try {
      const result = await dispatcher(name, args);
      return result;
    } catch (err) {
      const toolError = err instanceof MCPToolError ? err : mapToMCPToolError(err);
      logger.warn(`Tool '${name}' returned error: ${toolError.errorCode}`, {
        tool: name,
        error_code: toolError.errorCode,
      });

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(toolError.toResponse(), null, 2),
          },
        ],
      };
    }
  });

  return server;
}
