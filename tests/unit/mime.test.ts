import { describe, it, expect } from "vitest";
import {
  encodeHeader,
  buildRfc5322Message,
  toBase64Url,
} from "../../src/utils/mime.js";

describe("MIME and Encoding Utilities", () => {
  describe("encodeHeader", () => {
    it("should leave pure ASCII text unencoded", () => {
      const ascii = "Status Update for Sprint 42";
      expect(encodeHeader(ascii)).toBe(ascii);
    });

    it("should encode non-ASCII characters into RFC 2047 format", () => {
      const unicode = "Résumé & Café Update";
      const encoded = encodeHeader(unicode);
      expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    });
  });

  describe("buildRfc5322Message", () => {
    it("should format valid MIME message with recipients and base64 body", () => {
      const message = buildRfc5322Message({
        to: ["alice@example.com"],
        cc: ["bob@example.com"],
        bcc: ["charlie@example.com"],
        subject: "Sprint Notes",
        body: "Hello Team,\nHere are the notes.\nRegards.",
      });

      expect(message).toContain("To: alice@example.com");
      expect(message).toContain("Cc: bob@example.com");
      expect(message).toContain("Bcc: charlie@example.com");
      expect(message).toContain("Subject: Sprint Notes");
      expect(message).toContain('Content-Type: text/plain; charset="UTF-8"');
      expect(message).toContain("Content-Transfer-Encoding: base64");

      // Verify that body can be decoded back
      const parts = message.split("\r\n\r\n");
      expect(parts.length).toBeGreaterThanOrEqual(2);
      const decodedBody = Buffer.from(parts[1].replace(/\r\n/g, ""), "base64").toString("utf-8");
      expect(decodedBody).toBe("Hello Team,\nHere are the notes.\nRegards.");
    });
  });

  describe("toBase64Url", () => {
    it("should produce URL-safe base64 without +, / or trailing =", () => {
      const input = "Subjects with special characters: >>??++//==";
      const base64Url = toBase64Url(input);

      expect(base64Url).not.toContain("+");
      expect(base64Url).not.toContain("/");
      expect(base64Url).not.toContain("=");
    });
  });
});
