import { OAuth2Client } from "google-auth-library";
import { Config } from "../config.js";
import { TokenStore } from "./token-store.js";
import { MCPToolError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// Strictly minimal scopes required for V1 features
export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/documents",
];

export class GoogleOAuthManager {
  private oauth2Client: OAuth2Client;
  private tokenStore: TokenStore;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.tokenStore = new TokenStore(config.TOKEN_STORAGE_PATH);
    this.oauth2Client = new OAuth2Client(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI
    );

    // Automatically persist refreshed tokens
    this.oauth2Client.on("tokens", (tokens) => {
      logger.info("Received refreshed access token from Google.");
      this.tokenStore.saveTokens(tokens);
    });
  }

  getTokenStore(): TokenStore {
    return this.tokenStore;
  }

  /**
   * Generates authorization URL for user browser login flow.
   */
  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline", // Required to receive a refresh token
      prompt: "consent",      // Forces consent screen to ensure refresh token is returned
      scope: GOOGLE_WORKSPACE_SCOPES,
    });
  }

  /**
   * Exchanges authorization code for credentials and saves them to storage.
   */
  async exchangeCode(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.tokenStore.saveTokens(tokens);
  }

  /**
   * Returns an authorized OAuth2Client ready to make Google API calls.
   * Throws AUTH_REQUIRED if tokens are missing.
   */
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    const tokens = this.tokenStore.loadTokens();

    if (!tokens) {
      throw new MCPToolError(
        "AUTH_REQUIRED",
        "Google Workspace authorization required. Please run 'npm run auth' to authorize your account."
      );
    }

    this.oauth2Client.setCredentials(tokens);

    // Proactively verify or refresh if token is expired and refresh token is available
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      if (!tokens.refresh_token) {
        throw new MCPToolError(
          "AUTH_EXPIRED",
          "Google access token has expired and no refresh token is present. Please re-run 'npm run auth'."
        );
      }
      try {
        logger.info("Access token expired, requesting fresh token from Google...");
        const refreshed = await this.oauth2Client.refreshAccessToken();
        this.tokenStore.saveTokens(refreshed.credentials);
        this.oauth2Client.setCredentials(refreshed.credentials);
      } catch (err) {
        throw new MCPToolError(
          "AUTH_EXPIRED",
          "Failed to refresh Google access token. The refresh token may have been revoked. Please re-run 'npm run auth'.",
          { cause: err }
        );
      }
    }

    return this.oauth2Client;
  }
}
