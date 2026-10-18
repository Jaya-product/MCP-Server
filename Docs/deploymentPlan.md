# Railway Deployment Plan: Google Workspace MCP Server

This document outlines the step-by-step production deployment strategy for the **Google Workspace Model Context Protocol (`google-workspace-mcp`)** server on [Railway](https://railway.app).

---

## 1. Architectural Overview & Why Railway

The Google Workspace MCP server is an active Node.js service that:
1. Listens for incoming connections via HTTP (`streamable-http` transport).
2. Requires persistent storage for Google OAuth credentials (`tokens.json`), which Google continuously refreshes over time.
3. Must remain running without being terminated by short serverless function timeouts.

**Railway Architecture Topology:**
```
[ Remote AI Clients / Agents ]
              │ (HTTPS + Bearer Token)
              ▼
[ Railway Edge / Reverse Proxy (*.up.railway.app) ]
              │ (Port $PORT)
              ▼
[ Node.js Container (node dist/src/index.js) ]
     ├── Transport: streamable-http (0.0.0.0:$PORT)
     ├── Health Check: /health
     └── Persistent Volume (/app/.credentials/tokens.json)
              │
              ▼
[ Google APIs (Gmail API & Google Docs API) ]
```

---

## 2. Pre-Deployment Configuration Requirements

Before deploying to Railway, take note of three critical runtime differences between local execution and cloud containers:

### 2.1 Host Binding (`0.0.0.0`)
- **Local default:** `127.0.0.1` (loopback only).
- **Railway requirement:** Must listen on `0.0.0.0` so Railway's reverse proxy can forward traffic into the container.
- **Config:** Set `MCP_HOST=0.0.0.0` in Railway environment variables.

### 2.2 Dynamic Port Allocation
- Railway assigns a dynamic port via the `PORT` environment variable.
- In Railway service variables, set `MCP_PORT=${{PORT}}` so your server binds to the exact port Railway expects.

### 2.3 Transport Mode
- Local desktop clients (Claude Desktop) use standard input/output (`stdio`).
- Cloud deployment must use HTTP streaming: `MCP_TRANSPORT=streamable-http`.

---

## 3. The OAuth Token Strategy in Cloud Containers

Because `npm run auth` relies on a local interactive browser popup and an HTTP callback on `localhost:3000`, OAuth tokens must be generated on your local machine first and transferred to Railway.

### Why Persistent Disk is Mandatory
When Google access tokens expire, `google-workspace-mcp` automatically requests fresh tokens and writes them to `TOKEN_STORAGE_PATH`. If the filesystem is ephemeral (non-persistent), any deployment restart or crash would revert back to stale or deleted tokens. A **Railway Persistent Volume** solves this.

### Standard Workflow:
1. **Local Authorization:** Run `npm run auth` locally to generate valid tokens in `.credentials/tokens.json`.
2. **Mount Persistent Volume on Railway:** Attach a volume mounted at `/app/.credentials`.
3. **Seed the Volume:** Upload or copy `tokens.json` to the volume path. Once initialized, the server handles token refreshes autonomously.

---

## 4. Step-by-Step Railway Deployment Guide

### Step 1: Ensure Code & Git Repository Are Ready
Ensure all code is committed and pushed to your remote GitHub repository:
```bash
git status
git add .
git commit -m "feat: prepare project for Railway deployment"
git push origin main
```

*(Note: Verify that `.credentials/` is in your `.gitignore` so your personal tokens are NEVER pushed to GitHub).*

---

### Step 2: Create a Project on Railway
1. Log in to [Railway.app](https://railway.app).
2. Click **New Project** > **Deploy from GitHub repo**.
3. Select your repository (`google-workspace-mcp` or your repo name).
4. Railway will create the service.

---

### Step 3: Configure Build & Start Settings
Railway uses **Nixpacks** by default, which automatically detects Node.js and TypeScript.
1. Click on your deployed service in the Railway canvas.
2. Navigate to **Settings** > **Build & Deploy**.
3. Verify or configure:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Root Directory:** `/` (default)

---

### Step 4: Attach a Persistent Volume
1. In your service view, go to the **Volumes** tab (or click **+ New** > **Volume** in your canvas and link it to this service).
2. Set the **Mount Path** to:
   ```text
   /app/.credentials
   ```
   *(If deploying from root without a subfolder, `./.credentials` or `/app/.credentials` works).*
3. Save changes.

---

### Step 5: Configure Environment Variables
Navigate to the **Variables** tab of your service and set the following:

| Variable Name | Value / Description | Required | Sensitive? |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `production` | Yes | No |
| `MCP_TRANSPORT` | `streamable-http` | Yes | No |
| `MCP_HOST` | `0.0.0.0` | Yes | No |
| `MCP_PORT` | `${{PORT}}` *(Railway variable reference)* | Yes | No |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | Yes | Yes |
| `GOOGLE_CLIENT_SECRET`| Your Google OAuth Client Secret | Yes | Yes |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/oauth2callback` | Yes | No |
| `TOKEN_STORAGE_PATH`  | `/app/.credentials/tokens.json` | Yes | No |
| `MCP_API_KEY` | Strong random secret (e.g. `openssl rand -hex 24`) | **Strongly Recommended** | Yes |
| `REQUIRE_EMAIL_CONFIRMATION` | `true` | Yes | No |
| `LOG_LEVEL` | `info` | Yes | No |

---

### Step 6: Generate a Public Domain
1. In your service, navigate to **Settings** > **Networking**.
2. Click **Generate Domain**.
3. Railway will provision a public domain such as:
   ```text
   https://google-workspace-mcp-production.up.railway.app
   ```
4. This domain automatically includes SSL/TLS termination (HTTPS).

---

### Step 7: Seed OAuth Tokens onto the Railway Volume

You have two options to place your initial `tokens.json` onto the mounted volume:

#### Option A: Using Railway CLI (Fastest & Direct)
Install the Railway CLI locally and upload your local `.credentials/tokens.json` to the remote container:
```bash
# Install CLI (if not already installed)
npm install -g @railway/cli

# Link your local repo to your Railway project
railway login
railway link

# Copy local tokens into the remote mounted volume
railway run "mkdir -p /app/.credentials"
railway volume upload ./.credentials/tokens.json /app/.credentials/tokens.json
```

#### Option B: Environment Variable Seeding (Zero CLI Needed — Built-in!)
The server natively detects and persists initial credentials from either `GOOGLE_TOKENS_JSON` or `INITIAL_TOKENS_BASE64` on container startup:

1. **Get your encoded tokens:**
   ```powershell
   # Windows PowerShell (Base64 string):
   [Convert]::ToBase64String([IO.File]::ReadAllBytes(".credentials/tokens.json"))
   ```
2. **Add to Railway Variables:**
   - Key: `INITIAL_TOKENS_BASE64`
   - Value: *(paste the Base64 output string)*
   *(Or alternatively, paste the raw JSON into `GOOGLE_TOKENS_JSON`).*
3. **Leave Start Command as standard:** `npm start`
4. On startup, the server automatically reads the variable, securely writes `tokens.json` to your mounted persistent volume (`/app/.credentials/tokens.json`), and handles ongoing refreshes autonomously!

---

## 5. Post-Deployment Verification & Testing

### 1. Test Health Check Endpoint (Without Auth)
```bash
curl -i https://YOUR_RAILWAY_URL.up.railway.app/health
```
**Expected Response (HTTP 200 or HTTP 401 if API key is enforced):**
If `MCP_API_KEY` is set, unauthenticated requests will be rejected with `401 Unauthorized`.

### 2. Test Health Check Endpoint (With API Key)
```bash
curl -i -H "Authorization: Bearer YOUR_MCP_API_KEY" https://YOUR_RAILWAY_URL.up.railway.app/health
```
**Expected Response (HTTP 200):**
```json
{
  "status": "healthy",
  "name": "google-workspace-mcp",
  "version": "1.0.0"
}
```

### 3. Check Live Deployment Logs
In the Railway dashboard, open the **Deployments** tab and click on the active deployment:
- Confirm startup log: `Initializing google-workspace-mcp server on Streamable HTTP transport at 0.0.0.0:<PORT>...`
- Confirm server listening log: `Remote HTTP server listening at http://0.0.0.0:<PORT>`
- Ensure no crash or unhandled fatal error appears.

---

## 6. Connecting Remote Agents & MCP Clients

Once deployed and verified, external agents can interact with the server:

### Connection Details:
- **Base Endpoint:** `https://YOUR_RAILWAY_URL.up.railway.app`
- **Authentication:** `Bearer <MCP_API_KEY>`
- **Tools Supported:**
  - `gmail_send_email`: Dispatches emails through authorized Gmail.
  - `google_docs_append_text`: Appends content to authorized Google Docs.

---

## 7. Operational Runbook & Troubleshooting

### Problem 1: `AUTH_REQUIRED` or `AUTH_EXPIRED`
- **Cause:** The server cannot locate `tokens.json` at `/app/.credentials/tokens.json`, or the Google refresh token was revoked.
- **Fix:** Re-run `npm run auth` locally and re-upload the new `tokens.json` to the Railway volume.

### Problem 2: Railway Deployment Healthcheck Timeout
- **Cause:** The server is listening on `127.0.0.1` instead of `0.0.0.0`, or `MCP_PORT` does not match Railway's assigned `$PORT`.
- **Fix:** Double check that `MCP_HOST=0.0.0.0` and `MCP_PORT=${{PORT}}` are configured in Railway Variables.

### Problem 3: Google Token Expiration in Testing Mode
- **Cause:** In Google Cloud Console, if your OAuth Consent Screen is in **"Testing"** status, refresh tokens automatically expire after **7 days**.
- **Fix:** In Google Cloud Console under **OAuth consent screen**, set the publishing status to **In Production** (or click "Publish App"). External verification is not required for personal usage within allowed test accounts or organization users.
