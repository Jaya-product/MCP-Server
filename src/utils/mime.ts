/**
 * Utility for constructing RFC 5322 compliant MIME messages for Gmail API.
 */

export interface MimeMessageOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

/**
 * Encodes a string into RFC 2047 encoded-word syntax if it contains non-ASCII characters.
 */
export function encodeHeader(text: string): string {
  // If ASCII only and no special controls, return directly
  if (/^[\x20-\x7E]+$/.test(text)) {
    return text;
  }
  const base64 = Buffer.from(text, "utf-8").toString("base64");
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * Constructs an RFC 5322 plain text email message.
 */
export function buildRfc5322Message(options: MimeMessageOptions): string {
  const lines: string[] = [];

  // Required To header
  lines.push(`To: ${options.to.join(", ")}`);

  // Optional CC header
  if (options.cc && options.cc.length > 0) {
    lines.push(`Cc: ${options.cc.join(", ")}`);
  }

  // Optional BCC header (included in envelope headers before send)
  if (options.bcc && options.bcc.length > 0) {
    lines.push(`Bcc: ${options.bcc.join(", ")}`);
  }

  // Subject header
  lines.push(`Subject: ${encodeHeader(options.subject)}`);

  // MIME Headers for plain text UTF-8
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("Content-Transfer-Encoding: base64");
  lines.push(""); // Empty line separates headers from body

  // Base64 encode the body and chunk into 76-character lines per MIME standards
  const bodyBase64 = Buffer.from(options.body, "utf-8").toString("base64");
  const chunkedBody = bodyBase64.match(/.{1,76}/g)?.join("\r\n") || "";
  lines.push(chunkedBody);

  return lines.join("\r\n");
}

/**
 * Converts a string to standard URL-safe Base64 (base64url) without padding,
 * which is strictly required by the Google Gmail messages.send endpoint.
 */
export function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
