import { z } from "zod";
import dotenv from "dotenv";

// Load .env file if present
dotenv.config();

const booleanStringSchema = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === "boolean") return val;
    return val.toLowerCase() === "true" || val === "1";
  });

const numberStringSchema = (defaultValue: number) =>
  z
    .union([z.number(), z.string()])
    .transform((val) => {
      if (typeof val === "number") return val;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    });

export const ConfigSchema = z.object({
  GOOGLE_CLIENT_ID: z
    .string({
      required_error: "GOOGLE_CLIENT_ID is required. Set it in .env or environment.",
    })
    .min(1, "GOOGLE_CLIENT_ID cannot be empty"),
  GOOGLE_CLIENT_SECRET: z
    .string({
      required_error: "GOOGLE_CLIENT_SECRET is required. Set it in .env or environment.",
    })
    .min(1, "GOOGLE_CLIENT_SECRET cannot be empty"),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default("http://localhost:3000/oauth2callback"),
  TOKEN_STORAGE_PATH: z
    .string()
    .default("./.credentials/tokens.json"),
  GOOGLE_TOKENS_JSON: z
    .string()
    .optional(),
  INITIAL_TOKENS_BASE64: z
    .string()
    .optional(),
  MCP_TRANSPORT: z
    .enum(["stdio", "streamable-http"])
    .default("stdio"),
  MCP_HOST: z
    .string()
    .default("127.0.0.1"),
  MCP_PORT: numberStringSchema(8080).default(8080),
  MCP_API_KEY: z
    .string()
    .optional(),
  REQUIRE_EMAIL_CONFIRMATION: booleanStringSchema.default(true),
  MAX_EMAIL_RECIPIENTS: numberStringSchema(50).default(50),
  MAX_EMAIL_BODY_BYTES: numberStringSchema(1048576).default(1048576), // 1MB
  MAX_DOC_APPEND_BYTES: numberStringSchema(524288).default(524288),   // 500KB
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

/**
 * Loads, validates, and caches the server configuration.
 * Fails fast with clear descriptive error messages if required variables are missing.
 */
export function loadConfig(envOverrides?: Partial<Record<string, string>>): Config {
  if (cachedConfig && !envOverrides) {
    return cachedConfig;
  }

  const rawEnv = envOverrides ? { ...process.env, ...envOverrides } : process.env;

  // Resolve cloud platform defaults (Railway injects PORT and requires 0.0.0.0 binding)
  const isHttpTransport = (rawEnv.MCP_TRANSPORT || "stdio") === "streamable-http";
  const sourceEnv = {
    ...rawEnv,
    MCP_PORT: rawEnv.MCP_PORT || rawEnv.PORT || "8080",
    MCP_HOST: rawEnv.MCP_HOST || rawEnv.HOST || (isHttpTransport ? "0.0.0.0" : "127.0.0.1"),
  };

  const result = ConfigSchema.safeParse(sourceEnv);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(
      `[Configuration Error] Failed to validate required environment settings:\n${errorDetails}`
    );
  }

  if (!envOverrides) {
    cachedConfig = result.data;
  }

  return result.data;
}

/**
 * Resets cached config (useful for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
