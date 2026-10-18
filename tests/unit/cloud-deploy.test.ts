import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig, resetConfigCache } from "../../src/config.js";
import { TokenStore } from "../../src/auth/token-store.js";

describe("Cloud Deployment Features", () => {
  const originalEnv = { ...process.env };
  const tempDir = path.join(os.tmpdir(), "mcp-test-cloud-" + Date.now());

  beforeEach(() => {
    resetConfigCache();
    process.env = { ...originalEnv };
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfigCache();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should automatically use PORT from environment when MCP_PORT is not specified", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.PORT = "3500";
    delete process.env.MCP_PORT;

    const config = loadConfig();
    expect(config.MCP_PORT).toBe(3500);
  });

  it("should default MCP_HOST to 0.0.0.0 when MCP_TRANSPORT is streamable-http", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.MCP_TRANSPORT = "streamable-http";
    delete process.env.MCP_HOST;

    const config = loadConfig();
    expect(config.MCP_HOST).toBe("0.0.0.0");
  });

  it("should initialize tokens from GOOGLE_TOKENS_JSON when file does not exist", () => {
    const tokenPath = path.join(tempDir, "tokens.json");
    const mockTokens = {
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      scope: "https://www.googleapis.com/auth/gmail.send",
      token_type: "Bearer",
      expiry_date: Date.now() + 3600000,
    };

    process.env.GOOGLE_TOKENS_JSON = JSON.stringify(mockTokens);

    const store = new TokenStore(tokenPath);
    expect(fs.existsSync(tokenPath)).toBe(false);

    const loaded = store.loadTokens();
    expect(loaded).not.toBeNull();
    expect(loaded?.refresh_token).toBe("mock-refresh-token");
    expect(loaded?.access_token).toBe("mock-access-token");
    expect(fs.existsSync(tokenPath)).toBe(true);
  });

  it("should initialize tokens from INITIAL_TOKENS_BASE64 when file does not exist", () => {
    const tokenPath = path.join(tempDir, "tokens-b64.json");
    const mockTokens = {
      access_token: "b64-access-token",
      refresh_token: "b64-refresh-token",
    };

    const b64 = Buffer.from(JSON.stringify(mockTokens)).toString("base64");
    process.env.INITIAL_TOKENS_BASE64 = b64;
    delete process.env.GOOGLE_TOKENS_JSON;

    const store = new TokenStore(tokenPath);
    expect(fs.existsSync(tokenPath)).toBe(false);

    const loaded = store.loadTokens();
    expect(loaded).not.toBeNull();
    expect(loaded?.refresh_token).toBe("b64-refresh-token");
    expect(fs.existsSync(tokenPath)).toBe(true);
  });
});
