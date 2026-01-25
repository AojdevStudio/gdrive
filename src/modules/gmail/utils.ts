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
  // Check if subject contains non-ASCII characters (char codes > 127)
  const hasNonAscii = [...subject].some(char => char.charCodeAt(0) > 127);

  if (!hasNonAscii) {
    // ASCII only - just sanitize and return
    return sanitizeHeaderValue(subject);
  }

  // Encode as RFC 2047 MIME encoded-word using UTF-8 base64
  const encoded = Buffer.from(subject, 'utf-8').toString('base64');
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
