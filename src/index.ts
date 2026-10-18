#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import http from "http";
import { loadConfig } from "./config.js";
import { createMcpServer } from "./server.js";
import { logger, setLogLevel } from "./utils/logger.js";

async function main() {
  let config;
  try {
    config = loadConfig();
    setLogLevel(config.LOG_LEVEL);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[Fatal Startup Error] ${message}\n`);
    process.exit(1);
  }

  let httpServer: http.Server | null = null;
  const transports = new Map<string, SSEServerTransport>();
  const sessionServers = new Map<string, Server>();
  let stdioServer: Server | null = null;

  if (config.MCP_TRANSPORT === "stdio") {
    logger.info("Initializing google-workspace-mcp server on stdio transport...");
    stdioServer = createMcpServer(config);
    const transport = new StdioServerTransport();
    await stdioServer.connect(transport);
    logger.info("google-workspace-mcp server running and connected via stdio.");
  } else if (config.MCP_TRANSPORT === "streamable-http") {
    logger.info(
      `Initializing google-workspace-mcp server on Streamable HTTP transport at ${config.MCP_HOST}:${config.MCP_PORT}...`
    );

    httpServer = http.createServer(async (req, res) => {
      // Set permissive CORS headers for remote agent / browser clients
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = parsedUrl.pathname;

      // Public health check endpoint for Railway and load-balancer probes
      if (pathname === "/health" || pathname === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "healthy",
            name: "google-workspace-mcp",
            version: "1.0.0",
          })
        );
        return;
      }

      // Bearer API Key validation for protected MCP protocol endpoints
      if (config.MCP_API_KEY) {
        const authHeader = req.headers.authorization;
        const queryApiKey =
          parsedUrl.searchParams.get("apiKey") || parsedUrl.searchParams.get("api_key");
        const expected = `Bearer ${config.MCP_API_KEY}`;

        const isAuthorized = authHeader === expected || queryApiKey === config.MCP_API_KEY;
        if (!isAuthorized) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized: Invalid or missing Bearer API key" }));
          return;
        }
      }

      // Establish SSE stream endpoint
      if (req.method === "GET" && (pathname === "/sse" || pathname === "/mcp")) {
        try {
          const transport = new SSEServerTransport("/messages", res);
          const sessionId = transport.sessionId;
          const sessionServer = createMcpServer(config);

          transports.set(sessionId, transport);
          sessionServers.set(sessionId, sessionServer);

          transport.onclose = () => {
            logger.info(`SSE stream closed for session: ${sessionId}`);
            transports.delete(sessionId);
            sessionServers.delete(sessionId);
          };

          await sessionServer.connect(transport);
          logger.info(`Established SSE stream with session ID: ${sessionId}`);
        } catch (sseErr) {
          logger.error("Failed to establish SSE transport connection", {
            error: sseErr instanceof Error ? sseErr.message : String(sseErr),
          });
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to establish SSE transport connection" }));
          }
        }
        return;
      }

      // Handle JSON-RPC client messages
      if (req.method === "POST" && pathname === "/messages") {
        const sessionId = parsedUrl.searchParams.get("sessionId");
        if (!sessionId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing sessionId parameter" }));
          return;
        }

        const transport = transports.get(sessionId);
        if (!transport) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `No active session found for ID: ${sessionId}` }));
          return;
        }

        try {
          await transport.handlePostMessage(req, res);
        } catch (msgErr) {
          logger.error("Error processing client POST message", {
            sessionId,
            error: msgErr instanceof Error ? msgErr.message : String(msgErr),
          });
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Error processing client message" }));
          }
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Endpoint not found" }));
    });

    httpServer.listen(config.MCP_PORT, config.MCP_HOST, () => {
      logger.info(
        `Remote HTTP server listening at http://${config.MCP_HOST}:${config.MCP_PORT}`
      );
    });
  }

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info("Shutting down google-workspace-mcp server...");
    if (httpServer) {
      for (const [, transport] of transports) {
        try {
          await transport.close();
        } catch {
          // ignore cleanup errors on shutdown
        }
      }
      for (const [, s] of sessionServers) {
        try {
          await s.close();
        } catch {
          // ignore cleanup errors on shutdown
        }
      }
      httpServer.close();
    }
    if (stdioServer) {
      await stdioServer.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("Unhandled fatal error during runtime execution", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
