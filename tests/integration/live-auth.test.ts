import { describe, it, expect } from "vitest";
import { GoogleOAuthManager } from "../../src/auth/google-oauth.js";
import { loadConfig } from "../../src/config.js";

describe("Live OAuth Token Verification", () => {
  it("should successfully load saved credentials from .credentials/tokens.json", async () => {
    const config = loadConfig();
    const authManager = new GoogleOAuthManager(config);
    const client = await authManager.getAuthenticatedClient();

    expect(client).toBeDefined();
    expect(client.credentials).toBeDefined();
    expect(client.credentials.refresh_token || client.credentials.access_token).toBeTruthy();
  });
});
