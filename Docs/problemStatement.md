# Problem Statement: Cross-Agent MCP Server for Gmail and Google Docs

**File:** `problemStatement.md`\
**Status:** Draft for implementation\
**Working name:** `google-workspace-mcp`\
**Primary capabilities:** Send email through Gmail and append content to
an existing Google Doc\
**Target builders:** Cursor, Antigravity, or another coding agent\
**Target clients:** ChatGPT, Claude, Gemini, and any other
MCP-compatible agent/client

------------------------------------------------------------------------

## 1. Overview

Build a secure, reusable Model Context Protocol (MCP) server that
exposes a small, well-defined set of Google Workspace actions to AI
agents. The first release must support:

1.  Sending an email through a user's authorized Gmail account.
2.  Appending text to an existing Google Doc without replacing or
    deleting its current content.

The server must be **client-agnostic**. Business logic must not depend
on ChatGPT, Claude, Gemini, Cursor, Antigravity, or any particular model
provider. Any supported client should be able to connect through a
documented MCP transport, discover the tools and their input schemas,
and invoke them using the standard MCP protocol.

This is a tool server, not an AI agent. It should execute explicit tool
requests and return structured results. The connected agent is
responsible for interpreting the user's request, deciding when a tool is
appropriate, and supplying the arguments.

## 2. Problem to Solve

People use different AI assistants but need to perform the same everyday
work in Google Workspace. Without a shared integration, users may need
separate implementations for each assistant, copy content between tools,
or grant broad access through poorly understood integrations.

The desired solution is one independently deployable MCP server that: -
Integrates with Google APIs using secure, user-authorized credentials. -
Exposes predictable, documented tools. - Can be configured in multiple
MCP-compatible clients. - Provides clear success and failure results. -
Protects email and document content from accidental disclosure or
modification. - Can be extended with more Google Workspace tools later
without coupling the core to a specific AI vendor.

## 3. Goals

### Required for version 1

-   Send a plain-text email using the authenticated Gmail account.
-   Support recipients, optional CC/BCC, subject, and body.
-   Append text to an existing Google Doc identified by document ID or a
    configured document URL.
-   Preserve all existing document content.
-   Support a configurable separator/newline before appended text.
-   Authenticate to Google securely and use the minimum required API
    scopes.
-   Expose tools through MCP with clear descriptions and validated input
    schemas.
-   Support at least one local development transport and a
    remote-capable transport strategy.
-   Return machine-readable results and actionable error messages.
-   Include setup instructions, configuration examples, tests, and
    troubleshooting documentation.

### Explicitly out of scope for version 1

-   Reading, searching, or summarizing Gmail messages.
-   Reading or searching all Google Drive files.
-   Creating, deleting, moving, or sharing documents.
-   Editing or replacing existing document text.
-   Sending attachments, inline images, or HTML email.
-   Managing calendars, contacts, spreadsheets, or other Workspace
    products.
-   Automatically sending email based only on inferred intent, without
    an explicit tool invocation.
-   Supporting non-Google email or document providers.
-   Implementing a model, agent planner, or conversational UI inside the
    server.

These may be added later as separate tools with their own permissions
and safeguards.

## 4. Users and Main Use Cases

### Use case A: Send an email

A user tells an AI assistant: "Email Priya the meeting summary and ask
whether Tuesday works."

The assistant drafts the recipient, subject, and body, then calls the
MCP email tool with explicit arguments. The server validates the
request, sends the message through Gmail, and returns the Gmail message
identifier and a success status. The assistant reports the result to the
user.

**Expected behavior:** The server must not invent recipients or silently
send an incomplete message. The client should show the final recipient,
subject, and body for confirmation before sending where the client
supports confirmation. Server-side policy must be configurable to
require confirmation or an explicit `confirm_send` flag.

### Use case B: Append to an existing Google Doc

A user tells an AI assistant: "Add these decisions to our project notes
document."

The assistant supplies the document ID and the exact text to append. The
server inserts the text at the end of the document, preserving all
earlier content, and returns the document ID and operation status.

**Expected behavior:** The server must not overwrite the document, clear
content, or silently create a new document. If the document cannot be
identified or accessed, it must return a clear error.

### Use case C: Use the same server from another AI client

The user configures the server in Claude, Gemini, ChatGPT (where
MCP/custom connector support is available), Cursor, or another
compatible client.

The client connects, discovers the same tool definitions, and calls the
tools through MCP. No provider-specific business logic or duplicated
implementation should be required. Client-specific configuration may
still be needed because each product handles MCP connections and
authentication differently.

## 5. Functional Requirements

### FR-1: MCP protocol and tool discovery

-   Implement a standards-compliant MCP server using a maintained MCP
    SDK.
-   Publish tool names, descriptions, input schemas, and output
    structures.
-   Use stable, descriptive tool names:
    -   `gmail_send_email`
    -   `google_docs_append_text`
-   Validate all arguments server-side; never rely solely on the AI
    model to follow the schema.
-   Return structured tool output where supported, plus a concise
    human-readable status.
-   Keep tool names and business logic independent of any model or
    client vendor.
-   Version the server and document compatibility expectations.
-   Use a supported MCP transport appropriate to the deployment:
    -   **Local development:** stdio transport.
    -   **Remote deployment:** Streamable HTTP transport with proper
        authentication and TLS.
-   Do not assume every client supports every transport or OAuth flow.
    Document the verified configuration path for each tested client.

### FR-2: Gmail send-email tool

**Tool name:** `gmail_send_email`

**Purpose:** Send one email from the user's authenticated Gmail account.

**Required inputs** - `to`: One or more valid email addresses. -
`subject`: Non-empty subject line, subject to a configurable length
limit. - `body`: Plain-text message body.

**Optional inputs** - `cc`: One or more email addresses. - `bcc`: One or
more email addresses. - `confirm_send`: Boolean confirmation flag if
required by server policy. - `request_id`: Optional caller-generated
identifier for traceability and duplicate-send protection.

**Validation** - Validate email address syntax and reject malformed
recipient values. - Require at least one `to` recipient. - Apply
reasonable configurable limits to recipient count, subject length, and
body size. - Reject missing or whitespace-only subject/body unless
explicitly configured otherwise. - Normalize recipient input safely; do
not interpret arbitrary text as a recipient list. - Never accept
arbitrary Gmail API URLs, raw HTTP headers, or unrestricted API
parameters from the model. - Avoid logging message bodies or recipient
addresses by default.

**Execution** - Use the Gmail API with the authorized user's
credentials. - Construct a valid RFC 5322/MIME message for plain text
and encode it as required by the Gmail API (base64url). - Send through
the Gmail API's `users.messages.send` endpoint, using the authenticated
user's mailbox (`me`). - Do not claim that an email was sent until
Google confirms the API request succeeded. - Do not automatically retry
an ambiguous send failure without a duplicate-protection strategy; the
first request may have succeeded even if the response was lost. - Do not
expose access tokens, refresh tokens, or raw authorization headers in
tool output.

**Success output** - `success`: `true` - `message_id`: Gmail message
identifier, if returned - `thread_id`: Gmail thread identifier, if
returned - `status`: Concise status such as `Email sent` - `request_id`:
Echo the supplied request ID when applicable

**Failure output** - `success`: `false` - `error_code`: Stable
machine-readable code - `message`: Safe, actionable explanation -
`retryable`: Boolean when it can be determined safely

### FR-3: Google Docs append-text tool

**Tool name:** `google_docs_append_text`

**Purpose:** Add text to the end of an existing Google Doc while
preserving its current contents.

**Required inputs** - `document_id`: Google Docs document ID. The server
may optionally accept a Google Docs URL and extract the ID, but must
validate it. - `text`: Exact text to append; must not be empty or
whitespace-only.

**Optional inputs** - `prepend_newline`: Boolean, default `true`, to
separate the new content from existing content. - `request_id`: Optional
caller-generated identifier for traceability and duplicate-protection
support.

**Validation** - Require a document ID and text. - Reject unsupported
URLs and malformed document IDs. - Apply a configurable maximum text
size. - Do not interpret text as a command, HTML, or document ID. - Do
not create a new document if the requested document does not exist. - Do
not accept a replacement range or deletion request through this tool.

**Execution** - Use the Google Docs API with the authorized user's
credentials. - Append content using the API's end-of-document insertion
mechanism (for example, `insertText` with `endOfSegmentLocation` in
`documents.batchUpdate`). - If `prepend_newline` is true, add a newline
separator in a predictable manner. Avoid adding excessive blank lines. -
Preserve existing text and formatting as far as the Google Docs API's
append operation permits. - If Google returns a revision conflict or
other concurrent-edit error, return a safe error; do not blindly
overwrite or retry a potentially non-idempotent operation. - Do not
claim success until Google confirms the update. - The tool should not
read the document's entire contents merely to append text unless a
documented API requirement makes it necessary.

**Success output** - `success`: `true` - `document_id`: The target
document ID - `status`: Concise status such as
`Text appended to Google Doc` - `characters_appended`: Number of
characters submitted, including a separator if the server added one -
`request_id`: Echo the supplied request ID when applicable

**Failure output** - `success`: `false` - `error_code`: Stable
machine-readable code - `message`: Safe, actionable explanation -
`retryable`: Boolean when it can be determined safely

### FR-4: Authentication and Google authorization

-   Use Google OAuth 2.0 for user-delegated access.
-   Request only the scopes needed for the enabled tools. Evaluate the
    narrowest appropriate Gmail send scope and Google Docs editing
    scope; document the implications of each scope.
-   Do not request broad Gmail read access or broad Drive access unless
    a future feature genuinely requires it.
-   Provide a clear initial authorization flow and secure token storage.
-   Refresh access tokens securely when possible.
-   Handle revoked consent, expired/revoked refresh tokens, missing
    scopes, and reauthorization requirements.
-   Never commit client secrets, access tokens, refresh tokens, or
    credential files to source control.
-   Provide `.env.example` containing placeholder values only.
-   In local development, support an appropriate local secret store or
    an ignored credentials directory with restrictive file permissions.
-   For remote deployment, use a managed secret store or a documented
    encrypted storage solution.
-   Never print tokens or secrets to logs, errors, or tool responses.
-   Clearly distinguish user-delegated OAuth from service-account
    authentication. Do not assume a service account can access a user's
    Gmail or private Docs without explicit Workspace setup and
    appropriate delegation/sharing.

**Important Google API setup:** The implementation guide must explain
how to create/configure a Google Cloud project, enable the Gmail API and
Google Docs API, configure the OAuth consent screen, create OAuth
credentials, set redirect URIs, and handle test users or production
verification as applicable. Exact Google verification requirements can
vary by app type and requested scopes, so verify them against current
Google documentation during implementation.

### FR-5: Configuration

Support configuration via environment variables and/or a documented
config file. At minimum, define:

-   `GOOGLE_CLIENT_ID`
-   `GOOGLE_CLIENT_SECRET` (only where appropriate; never expose it)
-   `GOOGLE_REDIRECT_URI`
-   `MCP_TRANSPORT` (`stdio` or `streamable-http`)
-   `MCP_HOST` and `MCP_PORT` for remote mode, if applicable
-   `LOG_LEVEL`
-   `REQUIRE_EMAIL_CONFIRMATION` (default should be safe)
-   `MAX_EMAIL_RECIPIENTS`
-   `MAX_EMAIL_BODY_BYTES`
-   `MAX_DOC_APPEND_BYTES`
-   A secure token-storage setting or path, with local paths excluded
    from version control

Use safe defaults. Fail fast at startup when required configuration is
missing, with an error that explains which setting is missing but never
prints secret values.

### FR-6: Client portability

-   Keep the tool schemas and tool execution layer free of
    client-specific assumptions.
-   Provide example connection configuration for at least:
    -   Cursor
    -   Claude Desktop or another Claude MCP client
    -   Gemini, where the selected Gemini product supports MCP or an
        equivalent MCP connection path
    -   ChatGPT, where MCP/custom connector support is available to the
        user's account and environment
-   Clearly label examples as local or remote and distinguish server
    configuration from client configuration.
-   Do not claim universal compatibility without testing. Client
    products may differ in their support for stdio, remote MCP, OAuth,
    and confirmation prompts.
-   Provide a generic MCP client test procedure so a new client can
    verify tool discovery and invocation without code changes to the
    server.

### FR-7: Logging and observability

-   Log server startup/shutdown, tool name, duration, outcome, safe
    error code, and correlation/request ID.
-   Do not log email body content, document content, access tokens,
    refresh tokens, or client secrets.
-   Avoid logging full recipient lists or document URLs/IDs unless
    necessary and explicitly configured.
-   Use structured logs where practical.
-   Make logs useful for diagnosing permission, authentication,
    validation, and API failures without exposing private data.

## 6. Non-Functional Requirements

### Security and privacy

-   Treat all model-supplied arguments as untrusted input.
-   Use least-privilege OAuth scopes.
-   Require TLS for remote transport.
-   Authenticate and authorize remote MCP clients; do not expose an
    unauthenticated server on a public interface.
-   Restrict CORS/origins where relevant to the transport and
    deployment.
-   Protect against request forgery, token leakage, injection through
    headers, malformed MIME data, and oversized payloads.
-   Do not allow the model to choose arbitrary filesystem paths or
    execute shell commands.
-   Do not expose general-purpose Google API proxy tools.
-   Provide a clear data-flow and privacy section in the README.
-   Avoid storing message or document content unless the feature
    explicitly requires it.

### Reliability

-   Use bounded timeouts for Google API requests.
-   Return consistent error shapes.
-   Handle network failures, rate limits, API quota errors, permission
    errors, and expired credentials.
-   Retry only operations known to be safe to retry. Email sending and
    appending text can create duplicates, so ambiguous failures need
    special care.
-   Use request IDs for traceability. If true idempotency is
    implemented, document its limits and persistence requirements; do
    not claim a request ID alone guarantees exactly-once execution.

### Maintainability

-   Use typed inputs and outputs.
-   Separate MCP registration, Google API clients, validation,
    configuration, authentication, and logging.
-   Keep provider-specific code out of the business logic.
-   Pin or constrain dependencies and document supported runtime
    versions.
-   Include linting, formatting, and automated tests.
-   Keep tool descriptions clear enough for an AI model to select the
    correct tool and provide the correct arguments.

### Performance

-   Avoid unnecessary API calls.
-   Initialize clients and reusable dependencies efficiently.
-   Keep response payloads small and exclude document/email content from
    responses unless needed.
-   Set reasonable request and payload limits.

## 7. Suggested Architecture

The implementation language is not mandated. TypeScript/Node.js is a
reasonable default because the MCP ecosystem has a maintained TypeScript
SDK, but another language is acceptable if it has a maintained MCP SDK
and suitable Google API libraries.

Recommended layers:

1.  **MCP transport and server**
    -   Starts the selected transport.
    -   Registers tool names, descriptions, input schemas, and handlers.
    -   Handles MCP protocol messages.
2.  **Tool handlers**
    -   `gmail_send_email`
    -   `google_docs_append_text`
    -   Validate inputs and map internal results to MCP tool responses.
3.  **Google Workspace service layer**
    -   Gmail service constructs and sends the message.
    -   Docs service appends text.
    -   Contains no assumptions about which AI client called the tool.
4.  **Authentication/token provider**
    -   Obtains and refreshes OAuth credentials.
    -   Manages authorization errors and reauthorization.
    -   Keeps secrets separate from application logic.
5.  **Configuration and validation**
    -   Parses environment/config settings.
    -   Validates startup configuration and all tool arguments.
6.  **Logging and error mapping**
    -   Converts API and application errors to safe, stable error codes.
    -   Redacts sensitive data.

### Conceptual flow

`MCP client (ChatGPT / Claude / Gemini / Cursor / other)`\
→ `MCP transport`\
→ `Tool handler + validation`\
→ `OAuth credential provider`\
→ `Gmail API or Google Docs API`\
→ `Structured MCP result`\
→ `Calling client`

The client does not call Google APIs directly, and the server does not
depend on a specific model provider.

## 8. Proposed Tool Contracts

The following are conceptual contracts; adapt the exact JSON Schema to
the chosen SDK.

### `gmail_send_email`

Input:

``` json
{
  "to": ["person@example.com"],
  "cc": [],
  "bcc": [],
  "subject": "Meeting follow-up",
  "body": "Hi, here are the notes from our meeting.",
  "confirm_send": true,
  "request_id": "optional-correlation-id"
}
```

Output on success:

``` json
{
  "success": true,
  "message_id": "google-message-id",
  "thread_id": "google-thread-id",
  "status": "Email sent"
}
```

### `google_docs_append_text`

Input:

``` json
{
  "document_id": "google-docs-document-id",
  "text": "Decision: proceed with the pilot.",
  "prepend_newline": true,
  "request_id": "optional-correlation-id"
}
```

Output on success:

``` json
{
  "success": true,
  "document_id": "google-docs-document-id",
  "status": "Text appended to Google Doc",
  "characters_appended": 39
}
```

The examples are illustrative. Real tool schemas should specify types,
descriptions, required fields, limits, and allowed values. If the chosen
MCP SDK supports structured output schemas, use them. Do not include
secrets in tool arguments or outputs.

## 9. Confirmation and Safe-Execution Policy

Email sending is an external, potentially irreversible action. The
system must make it difficult for a mistaken model call to send a
message to the wrong person.

-   Make confirmation behavior configurable.
-   For an interactive client, the recommended flow is: draft → show
    recipient/CC/BCC/subject/body → user confirms → call send tool.
-   If confirmation is enforced server-side, require an explicit
    confirmation signal in the tool call and reject sends without it.
    Document that a Boolean supplied by an untrusted model is not, by
    itself, a secure human-approval mechanism.
-   Where a client supports tool approval/confirmation UX, use it as an
    additional safeguard.
-   Do not send merely because the user asked to draft or review an
    email.
-   Do not silently alter the email body or recipients.
-   For Google Docs, append only the supplied text to the specified
    document. If the target is ambiguous, the calling agent should ask
    the user to identify the document before invoking the tool.
-   A future implementation may add a separate draft/preview tool, but
    do not expand version 1 without a clear requirement.

## 10. Error Handling

Use stable error codes such as:

-   `INVALID_ARGUMENT`
-   `MISSING_CONFIGURATION`
-   `AUTH_REQUIRED`
-   `AUTH_EXPIRED`
-   `INSUFFICIENT_SCOPE`
-   `RESOURCE_NOT_FOUND`
-   `PERMISSION_DENIED`
-   `GOOGLE_API_RATE_LIMIT`
-   `GOOGLE_API_UNAVAILABLE`
-   `REQUEST_TOO_LARGE`
-   `CONFIRMATION_REQUIRED`
-   `DUPLICATE_RISK`
-   `INTERNAL_ERROR`

Error responses must: - Explain what failed in plain language. - Give a
safe next step where possible. - Avoid stack traces, token values,
secret values, and private message/document content. - Distinguish a
definite failure from an ambiguous outcome where the operation may have
succeeded. - Use a non-success MCP tool result/error status
consistently, according to the selected SDK's conventions.

## 11. Testing Requirements

### Unit tests

-   Validate required and optional email fields.
-   Reject malformed addresses, empty recipients, empty body/subject
    under the configured policy, and oversized payloads.
-   Validate document ID/URL input and reject empty append text.
-   Test newline separator behavior.
-   Verify that errors are redacted.
-   Verify that configuration failures do not leak secret values.

### Integration tests

Use a dedicated Google test account and test document. Do not use a
personal production mailbox or important live document.

-   Successfully send a test email to a controlled test inbox.
-   Verify recipient, subject, and body at the receiving end.
-   Append a unique marker to a test Google Doc and verify that prior
    content remains unchanged and the marker appears at the end.
-   Test missing scopes, revoked access, inaccessible documents, invalid
    document IDs, quota/rate-limit responses, and network timeouts.
-   Verify that an ambiguous send timeout is not blindly retried and
    does not falsely report definite failure or success.

### MCP compatibility tests

-   Start the server using the documented local transport.
-   Confirm that a generic MCP inspector/client can connect and discover
    both tools.
-   Confirm each tool schema is visible and valid.
-   Invoke each tool with valid and invalid arguments.
-   Verify that results are structured and readable.
-   Test each client configuration that is advertised in the README.
    Mark untested clients as unverified.

### Security tests

-   Search logs and error responses for accidental token or message-body
    leakage.
-   Confirm the remote endpoint is not publicly accessible without
    authentication.
-   Confirm invalid tool arguments cannot trigger arbitrary API calls or
    filesystem access.
-   Confirm OAuth scopes are limited to the intended capabilities.

## 12. Acceptance Criteria

Version 1 is complete when all of the following are true:

1.  The project can be installed from a clean checkout using the README
    instructions.
2.  Required configuration is documented, and startup fails clearly when
    mandatory values are missing.
3.  A user can authorize a Google account through the documented OAuth
    flow.
4.  An MCP-compatible client can discover `gmail_send_email` and
    `google_docs_append_text`.
5.  A valid email tool call sends a message through the authorized Gmail
    account and returns a confirmed result.
6.  Invalid email arguments are rejected before the Google API is
    called.
7.  A valid append call adds text to the end of the selected existing
    Google Doc.
8.  The append operation does not replace or delete prior content.
9.  Invalid or inaccessible document targets return actionable errors.
10. Tokens and private message/document content do not appear in logs or
    tool responses.
11. Email confirmation policy is documented and enforced as configured.
12. Automated unit tests pass; integration tests are documented and pass
    with a configured test account.
13. A generic MCP client can invoke the tools without any
    provider-specific server code.
14. The README includes client configuration examples and clearly labels
    which have been verified.
15. The project includes `.env.example`, `.gitignore`, a license
    decision/placeholder, and a clear security/privacy section.

## 13. Deliverables Expected from the Coding Agent

The coding agent (Cursor, Antigravity, or another environment) should
produce:

-   Working MCP server source code.
-   Dependency manifest and lockfile.
-   Environment/configuration validation.
-   OAuth setup and token-handling implementation.
-   Gmail send-email tool.
-   Google Docs append-text tool.
-   Unit tests and documented integration tests.
-   `.env.example` with placeholders only.
-   `.gitignore` that excludes credentials, token caches, local secrets,
    build output, and environment files.
-   `README.md` with architecture, prerequisites, Google Cloud setup,
    local run instructions, client setup examples, tool schemas,
    security notes, troubleshooting, and deployment guidance.
-   Example MCP configuration files/snippets for supported clients.
-   A short implementation summary listing decisions, commands to run,
    tests executed, known limitations, and any setup steps that still
    require the user.

The coding agent must not fabricate test results or claim that OAuth,
Google API access, or client compatibility was verified unless it
actually ran the relevant test.

## 14. Suggested Project Structure

``` text
google-workspace-mcp/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── config.ts
│   ├── auth/
│   │   └── google-oauth.ts
│   ├── tools/
│   │   ├── gmail-send-email.ts
│   │   └── google-docs-append-text.ts
│   ├── services/
│   │   ├── gmail-service.ts
│   │   └── docs-service.ts
│   ├── validation/
│   │   └── schemas.ts
│   └── utils/
│       ├── errors.ts
│       └── logger.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── examples/
│   └── mcp-config.example.json
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── problemStatement.md
```

This is a suggested structure, not a rigid requirement. Keep the
implementation as simple as possible while preserving clear separation
of concerns.

## 15. Implementation Decisions the Coding Agent Must Document

Before or during implementation, explicitly document:

1.  Language, runtime version, and MCP SDK selected.
2.  Local and remote transports supported.
3.  OAuth flow and token storage approach.
4.  Exact Google API scopes requested and why.
5.  How email confirmation is enforced and what protection is provided
    by the client versus the server.
6.  How duplicate risk is handled after ambiguous send/append failures.
7.  Which clients were actually tested and on which transport.
8.  How remote MCP authentication is implemented, if remote deployment
    is supported.
9.  Which Google Cloud setup steps require manual user action.
10. Known limitations and steps required before production deployment.

Prefer secure, maintainable defaults over speculative abstractions. Do
not build a large framework for two tools, but keep the service layer
extensible enough to add more Workspace tools later.

## 16. Definition of Done

The MCP server is ready for initial use when it can be run locally,
authorized against a test Google account, connected to a generic MCP
client, and used to send a confirmed test email and append a test entry
to an existing Google Doc---without replacing existing document content,
exposing secrets, or depending on a specific AI provider.

**Core design principle:** Implement Google Workspace capabilities once
behind the MCP standard; let each compatible AI client discover and
invoke those capabilities through its own supported connection
mechanism.
