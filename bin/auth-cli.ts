#!/usr/bin/env node

import http from "http";
import url from "url";
import { exec } from "child_process";
import { loadConfig } from "../src/config.js";
import { GoogleOAuthManager } from "../src/auth/google-oauth.js";

function openBrowser(targetUrl: string) {
  const startCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
      ? 'start ""'
      : "xdg-open";
  exec(`${startCmd} "${targetUrl}"`);
}

async function runAuthCli() {
  console.log("\n========================================================");
  console.log(" Google Workspace MCP Server - OAuth 2.0 Authorization ");
  console.log("========================================================\n");

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const authManager = new GoogleOAuthManager(config);
  const redirectUrl = new URL(config.GOOGLE_REDIRECT_URI);
  const port = parseInt(redirectUrl.port || "3000", 10);
  const pathname = redirectUrl.pathname || "/oauth2callback";

  const authUrl = authManager.generateAuthUrl();

  console.log("Starting temporary OAuth callback server on port " + port + "...");

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url || "", true);

      if (parsedUrl.pathname === pathname) {
        const code = parsedUrl.query.code as string;
        const error = parsedUrl.query.error as string;

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
              <h1 style="color:#d93025;">Authorization Failed</h1>
              <p>Google returned error: ${error}</p>
            </body></html>`
          );
          console.error(`\n[OAuth Error] Google returned authorization error: ${error}`);
          server.close();
          process.exit(1);
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("Missing 'code' query parameter.");
          return;
        }

        console.log("Authorization code received. Exchanging for tokens...");
        await authManager.exchangeCode(code);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
            <h1 style="color:#188038;">Authentication Successful!</h1>
            <p>Your Google Workspace credentials have been securely stored.</p>
            <p>You can now close this browser tab and return to your terminal.</p>
          </body></html>`
        );

        console.log("\n[Success] OAuth tokens received and securely persisted!");
        console.log(`Token storage path: ${authManager.getTokenStore().getFilePath()}`);
        console.log("\nYou are now ready to run the MCP server!");

        server.close();
        process.exit(0);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    } catch (err) {
      console.error("\n[Error during token exchange]:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error during token exchange.");
      server.close();
      process.exit(1);
    }
  });

  server.listen(port, () => {
    console.log(`Waiting for Google OAuth redirect on ${config.GOOGLE_REDIRECT_URI}...\n`);
    console.log("Opening your browser to Google authorization consent screen:\n");
    console.log(`  ${authUrl}\n`);
    console.log("If your browser did not open automatically, copy and paste the link above.\n");

    openBrowser(authUrl);
  });
}

runAuthCli().catch((err) => {
  console.error("Unexpected error in auth CLI:", err);
  process.exit(1);
});
