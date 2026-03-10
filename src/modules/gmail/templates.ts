/**
 * Template rendering utility for Gmail outreach operations.
 * Shared by sendFromTemplate, sendBatch, and dryRun.
 *
 * Handles {{variable}} replacement in both subject and body strings.
 * - Missing variables throw (fail loud, not silent blanks)
 * - When isHtml is true, variable values are HTML-escaped before insertion
 */

/**
 * Escape HTML special characters to prevent XSS when inserting
 * user-provided values into HTML email templates.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a template string by replacing {{variable}} placeholders
 * with values from the provided variables object.
 *
 * @param template - Template string with {{variable}} placeholders
 * @param variables - Key-value map of variable names to replacement values
 * @param isHtml - When true, variable values are HTML-escaped before insertion (default: false)
 * @returns Rendered string with all placeholders replaced
 * @throws Error if a placeholder references a variable not present in the variables object
 *
 * @example
 * ```typescript
 * renderTemplate('Hello {{name}}!', { name: 'Amy' });
 * // => 'Hello Amy!'
 *
 * renderTemplate('<p>{{content}}</p>', { content: '<script>' }, true);
 * // => '<p>&lt;script&gt;</p>'
 * ```
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>,
  isHtml: boolean = false
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string): string => {
    if (!(key in variables)) {
      throw new Error(`Missing template variable: ${key}`);
    }
    const value = variables[key] as string;
    return isHtml ? escapeHtml(value) : value;
  });
}
