import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../../src/config.js";
import { createMcpServer } from "../../src/server.js";

describe("MCP Server End-to-End Flow", () => {
  it("should initialize server, connect client, and list available tools", async () => {
    const config = loadConfig();
    const server = createMcpServer(config);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const toolsResponse = await client.listTools();
    expect(toolsResponse.tools).toHaveLength(2);

    const toolNames = toolsResponse.tools.map((t) => t.name);
    expect(toolNames).toContain("gmail_send_email");
    expect(toolNames).toContain("google_docs_append_text");

    // Test calling tool with missing required parameters (should return error gracefully)
    const callResult = await client.callTool({
      name: "gmail_send_email",
      arguments: {},
    });

    expect(callResult.isError).toBe(true);
    expect(callResult.content).toBeDefined();
    const parsedError = JSON.parse((callResult.content[0] as { text: string }).text);
    expect(parsedError.error_code).toBe("INVALID_ARGUMENT");

    // Test confirmation guardrail when confirm_send is false
    const unconfirmedCall = await client.callTool({
      name: "gmail_send_email",
      arguments: {
        to: ["test@example.com"],
        subject: "Test Subject",
        body: "Test Body",
        confirm_send: false,
      },
    });

    expect(unconfirmedCall.isError).toBe(true);
    const unconfirmedParsed = JSON.parse((unconfirmedCall.content[0] as { text: string }).text);
    expect(unconfirmedParsed.error_code).toBe("CONFIRMATION_REQUIRED");

    await client.close();
    await server.close();
  });
});
