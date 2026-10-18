# Google Workspace MCP Server (`google-workspace-mcp`)

A secure, client-agnostic [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides AI agents (Claude, Cursor, ChatGPT, Gemini, Antigravity) with controlled, user-authorized actions in Google Workspace.

---

## Capabilities (Version 1)

1. **`gmail_send_email`**: Sends plain-text emails through the user's authorized Gmail account. Supports `to`, `cc`, `bcc`, `subject`, and `body`. Includes a configurable safe confirmation policy.
2. **`google_docs_append_text`**: Non-destructively appends plain text to the very end of an existing Google Doc. **Guaranteed never to overwrite, delete, or replace existing document content.**

---

## Architectural Highlights

- **Client Agnostic:** 100% compliant with standard MCP JSON-RPC 2.0 specifications. No client-specific or vendor-specific dependencies in business logic.
- **Least-Privilege Scopes:** Requests only `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/documents`. Broad read scopes (e.g. `gmail.readonly`, full `drive`) are strictly prohibited.
- **Safe Confirmation Policy:** By default (`REQUIRE_EMAIL_CONFIRMATION=true`), the server forces a two-phase commit on outbound emails, requiring the calling agent to confirm intent with the user before dispatching.
- **Strict Privacy & Zero PII Logging:** All logs output to `stderr` in structured JSON. Email bodies, document content, recipient addresses, and OAuth tokens are strictly masked and redacted.
- **Stdio Integrity:** The `stdout` stream is exclusively reserved for framed MCP protocol communication.

For complete architectural details, see [`Docs/Architecture.md`](file:///c:/Users/jaya.manocha/Documents/myProjects/MCP/Docs/Architecture.md).

---

## Prerequisites

- **Node.js**: v20.0.0 or higher
- **Google Cloud Account**: With permission to create an OAuth 2.0 application

---

## Quickstart & Setup Guide

### 1. Google Cloud Platform Configuration

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Google Cloud Project (e.g. `google-workspace-mcp-app`).
3. Enable Required APIs:
   - Navigate to **APIs & Services > Library**.
   - Search for **Gmail API** and click **Enable**.
   - Search for **Google Docs API** and click **Enable**.
4. Configure OAuth Consent Screen:
   - Navigate to **APIs & Services > OAuth consent screen**.
   - Choose **External** (or **Internal** if using a Google Workspace organization).
   - Fill in the required application name and support email.
   - On the **Scopes** step, add the following two scopes:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/documents`
   - Under **Test users**, add your Google email address.
5. Create OAuth Credentials:
   - Navigate to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Workspace MCP Client`.
   - Authorized redirect URIs: `http://localhost:3000/oauth2callback`.
   - Click **Create** and copy your **Client ID** and **Client Secret**.

### 2. Configure Environment

Copy the example environment template and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
TOKEN_STORAGE_PATH=./.credentials/tokens.json
REQUIRE_EMAIL_CONFIRMATION=true
LOG_LEVEL=info
```

### 3. Authorize Your Google Account

Run the interactive authorization CLI:

```bash
npm run auth
```

- Your default browser will open automatically to Google's OAuth consent screen.
- Select your test Google account and grant the requested Gmail and Google Docs permissions.
- Once completed, the tokens will be automatically saved to `./.credentials/tokens.json` with secure `0600` permissions.

### 4. Build the Project

```bash
npm run build
```

---

## Client Configuration Examples

### Claude Desktop

Add the following to your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["c:/Users/jaya.manocha/Documents/myProjects/MCP/dist/src/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "TOKEN_STORAGE_PATH": "c:/Users/jaya.manocha/Documents/myProjects/MCP/.credentials/tokens.json",
        "REQUIRE_EMAIL_CONFIRMATION": "true"
      }
    }
  }
}
```

### Cursor IDE

Create or update `.cursor/mcp.json` in your project root or user config:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["c:/Users/jaya.manocha/Documents/myProjects/MCP/dist/src/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "TOKEN_STORAGE_PATH": "c:/Users/jaya.manocha/Documents/myProjects/MCP/.credentials/tokens.json"
      }
    }
  }
}
```

---

## Tool Reference

### `gmail_send_email`

Sends an email using the authenticated Gmail account.

**Parameters:**
- `to` (*array of strings, required*): One or more valid recipient email addresses.
- `subject` (*string, required*): Non-empty subject line (max 500 characters).
- `body` (*string, required*): Plain-text body content.
- `cc` (*array of strings, optional*): Carbon-copy recipient email addresses.
- `bcc` (*array of strings, optional*): Blind-carbon-copy recipient email addresses.
- `confirm_send` (*boolean, optional*): Explicit confirmation flag. Required when `REQUIRE_EMAIL_CONFIRMATION=true`.
- `request_id` (*string, optional*): Correlation ID for traceability and duplicate prevention.

**Example Response:**
```json
{
  "success": true,
  "message_id": "18f0a1b2c3d4e5f6",
  "thread_id": "18f0a1b2c3d4e5f6",
  "status": "Email sent"
}
```

---

### `google_docs_append_text`

Appends text to the end of a document without modifying prior contents.

**Parameters:**
- `document_id` (*string, required*): Google Docs document ID or full `docs.google.com` URL.
- `text` (*string, required*): Exact plain text to append.
- `prepend_newline` (*boolean, optional, default: true*): Inserts a newline separator before the appended text.
- `request_id` (*string, optional*): Correlation ID.

**Example Response:**
```json
{
  "success": true,
  "document_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "status": "Text appended to Google Doc",
  "characters_appended": 42
}
```

---

## Error Handling & Taxonomy

When a failure occurs, tools return a standardized error object:

```json
{
  "success": false,
  "error_code": "RESOURCE_NOT_FOUND",
  "message": "The requested Google Doc or mailbox resource was not found. Please verify the document ID.",
  "retryable": false
}
```

| Error Code | Description |
| :--- | :--- |
| `INVALID_ARGUMENT` | Malformed email addresses, empty text, or schema validation error. |
| `CONFIRMATION_REQUIRED` | Email was invoked without `confirm_send: true` under active policy. |
| `AUTH_REQUIRED` | Missing OAuth credentials. Run `npm run auth`. |
| `AUTH_EXPIRED` | Refresh token expired or was revoked. Re-run `npm run auth`. |
| `INSUFFICIENT_SCOPE` | Google account has not granted Gmail send or Docs permissions. |
| `RESOURCE_NOT_FOUND` | Document ID does not exist. |
| `PERMISSION_DENIED` | Account does not have write access to the document. |
| `GOOGLE_API_RATE_LIMIT` | Rate limit or quota exceeded (retryable). |
| `REQUEST_TOO_LARGE` | Email body or document append exceeds configured maximum size. |

---

## Testing

Run the automated test suite with Vitest:

```bash
npm test
```

Build verification:

```bash
npm run build
```

---

## License

Licensed under the Apache License, Version 2.0. See [`LICENSE`](file:///c:/Users/jaya.manocha/Documents/myProjects/MCP/LICENSE) for details.
