import fs from "fs";
import path from "path";
import os from "os";
import { Credentials } from "google-auth-library";
import { logger } from "../utils/logger.js";
import { MCPToolError } from "../utils/errors.js";

/**
 * Resolves ~ or relative paths to an absolute path.
 */
export function resolveTokenPath(storagePath: string): string {
  if (storagePath.startsWith("~")) {
    return path.join(os.homedir(), storagePath.slice(1));
  }
  return path.resolve(process.cwd(), storagePath);
}

export class TokenStore {
  private filePath: string;

  constructor(storagePath: string) {
    this.filePath = resolveTokenPath(storagePath);
  }

  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Loads credentials from storage. Returns null if token file does not exist.
   */
  loadTokens(): Credentials | null {
    if (!fs.existsSync(this.filePath)) {
      // Check if tokens were provided via environment variables (useful for cloud platforms like Railway)
      const envTokens =
        process.env.GOOGLE_TOKENS_JSON ||
        (process.env.INITIAL_TOKENS_BASE64
          ? Buffer.from(process.env.INITIAL_TOKENS_BASE64, "base64").toString("utf-8")
          : null);

      if (envTokens) {
        try {
          const parsed = JSON.parse(envTokens) as Credentials;
          if (parsed.refresh_token || parsed.access_token) {
            logger.info("Initializing token store from environment variable on cloud deployment...", {
              filePath: this.filePath,
            });
            this.saveTokens(parsed);
            return parsed;
          }
        } catch (envErr) {
          logger.warn("Failed to parse tokens from environment variable.", {
            error: envErr instanceof Error ? envErr.message : String(envErr),
          });
        }
      }

      return null;
    }

    try {
      const content = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(content) as Credentials;

      if (!parsed.refresh_token && !parsed.access_token) {
        logger.warn("Token file found but contains no valid tokens.", {
          filePath: this.filePath,
        });
        return null;
      }

      return parsed;
    } catch (err) {
      logger.error("Failed to read or parse token storage file.", {
        filePath: this.filePath,
      });
      throw new MCPToolError(
        "AUTH_REQUIRED",
        `Token file at ${this.filePath} is corrupted or unreadable. Please run 'npm run auth' to re-authenticate.`
      );
    }
  }

  /**
   * Saves credentials to storage with restrictive file permissions.
   */
  saveTokens(tokens: Credentials): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // Merge with existing file tokens if any to prevent loss of refresh_token on access_token refresh
    let existing: Credentials = {};
    if (fs.existsSync(this.filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as Credentials;
      } catch {
        existing = {};
      }
    }
    const merged: Credentials = {
      ...existing,
      ...tokens,
      // Retain existing refresh_token if new token set does not include one
      refresh_token: tokens.refresh_token || existing.refresh_token,
    };

    fs.writeFileSync(this.filePath, JSON.stringify(merged, null, 2), {
      encoding: "utf-8",
      mode: 0o600, // Restrictive permissions: read/write for owner only
    });

    // Enforce 0600 mode on existing files as well (especially on Unix-like environments)
    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch {
      // chmod might be a no-op or throw on Windows, safely continue
    }

    logger.info("Successfully persisted OAuth credentials to token store.", {
      path: this.filePath,
    });
  }

  /**
   * Deletes token file (used during logout / revoking)
   */
  clearTokens(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
      logger.info("Cleared token file.", { path: this.filePath });
    }
  }
}
