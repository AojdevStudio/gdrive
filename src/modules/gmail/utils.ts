/**
 * Gmail shared utilities - security validation and encoding functions
 * Used by both compose.ts and send.ts for consistent security
 */

/**
 * Sanitize header field value by stripping CR/LF to prevent header injection
 * @param value Header field value to sanitize
 * @returns Sanitized value with CR/LF removed
 */
export function sanitizeHeaderValue(value: string): string {
  // Remove any CR (\r) or LF (\n) characters to prevent header injection attacks
  return value.replace(/[\r\n]/g, '');
}

/**
 * Simple RFC 5322-like email address validation
 * Validates basic structure: local-part@domain
 * Supports "Name <email>" format
 * @param email Email address to validate
 * @returns true if email is valid
 */
export function isValidEmailAddress(email: string): boolean {
  // Extract email from "Name <email>" format if present
  const match = email.match(/<([^>]+)>/) || [null, email];
  const address = match[1]?.trim() || email.trim();

  // Basic RFC 5322 pattern: local-part@domain
  // Local part: alphanumeric, dots, underscores, hyphens, plus signs
  // Domain: alphanumeric segments separated by dots
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailPattern.test(address);
}

/**
 * Encode subject using RFC 2047 MIME encoded-word for non-ASCII characters
 * Uses UTF-8 base64 encoding: =?UTF-8?B?<base64>?=
 * @param subject Subject line to encode
 * @returns Encoded subject (unchanged if ASCII-only)
 */
export function encodeSubject(subject: string): string {
  // Always sanitize first to prevent header injection (even for non-ASCII paths)
  const sanitized = sanitizeHeaderValue(subject);

  // Check for non-ASCII using a loop (avoids array spread allocation)
  let hasNonAscii = false;
  for (let i = 0; i < sanitized.length; i++) {
    if (sanitized.charCodeAt(i) > 127) {
      hasNonAscii = true;
      break;
    }
  }

  if (!hasNonAscii) {
    return sanitized;
  }

  // Encode as RFC 2047 MIME encoded-word using UTF-8 base64
  const encoded = Buffer.from(sanitized, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Validate and sanitize email addresses
 * @param emails Array of email addresses to validate
 * @param fieldName Name of the field (for error messages)
 * @returns Sanitized addresses
 * @throws Error if any email is invalid
 */
export function validateAndSanitizeRecipients(emails: string[], fieldName: string): string[] {
  return emails.map(email => {
    const sanitized = sanitizeHeaderValue(email);
    if (!isValidEmailAddress(sanitized)) {
      throw new Error(`Invalid email address in ${fieldName}: ${sanitized}`);
    }
    return sanitized;
  });
}

/**
 * Build an RFC 2822 formatted email message with security hardening
 *
 * Security measures:
 * - CR/LF stripped from all header fields to prevent header injection
 * - Email addresses validated against RFC 5322 pattern
 * - Subject encoded using RFC 2047 for non-ASCII characters
 * - Bcc included in raw message (Gmail API reads Bcc from raw, delivers to those recipients, and strips the header from delivered copies)
 *
 * @param options Message content and recipients
 * @returns RFC 2822 formatted email string
 */
export function buildEmailMessage(options: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  from?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const { to, cc, bcc, subject, body, isHtml = false, from, inReplyTo, references } = options;

  const lines: string[] = [];

  // Add headers with sanitization and validation
  if (from) {
    const sanitizedFrom = sanitizeHeaderValue(from);
    if (!isValidEmailAddress(sanitizedFrom)) {
      throw new Error(`Invalid from email address: ${sanitizedFrom}`);
    }
    lines.push(`From: ${sanitizedFrom}`);
  }

  // Validate and sanitize recipients
  const sanitizedTo = validateAndSanitizeRecipients(to, 'to');
  lines.push(`To: ${sanitizedTo.join(', ')}`);

  if (cc && cc.length > 0) {
    const sanitizedCc = validateAndSanitizeRecipients(cc, 'cc');
    lines.push(`Cc: ${sanitizedCc.join(', ')}`);
  }

  if (bcc && bcc.length > 0) {
    const sanitizedBcc = validateAndSanitizeRecipients(bcc, 'bcc');
    lines.push(`Bcc: ${sanitizedBcc.join(', ')}`);
  }

  // Encode subject with RFC 2047 for non-ASCII support
  lines.push(`Subject: ${encodeSubject(subject)}`);

  if (inReplyTo) {
    lines.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyTo)}`);
  }
  if (references) {
    lines.push(`References: ${sanitizeHeaderValue(references)}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
  lines.push(''); // Empty line between headers and body
  lines.push(body);

  return lines.join('\r\n');
}

/**
 * Encode message to base64url format for Gmail API
 * @param content String content to encode
 * @returns Base64url encoded string
 */
export function encodeToBase64Url(content: string): string {
  return Buffer.from(content)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
