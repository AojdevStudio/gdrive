/**
 * PAI Contact Resolution for Calendar Module
 *
 * Resolves contact names to email addresses from PAI contact list.
 * Supports:
 * - First names: "Mary" -> "findsbymary@gmail.com"
 * - Raw emails: "user@example.com" -> "user@example.com"
 * - Mixed: ["Mary", "user@example.com"] -> ["findsbymary@gmail.com", "user@example.com"]
 */

import * as fs from 'fs/promises';
import type { Logger } from 'winston';
import type { ContactEntry, ResolvedContact } from './types.js';

/**
 * Default PAI contacts file path
 * Can be overridden via PAI_CONTACTS_PATH environment variable
 */
const DEFAULT_CONTACTS_PATH = '/Users/ossieirondi/PAI/.claude/skills/CORE/USER/CONTACTS.md';

/**
 * Basic email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse PAI CONTACTS.md file format
 *
 * Expected format:
 * - **Mary** [Wife/Life Partner] - findsbymary@gmail.com
 * - **Kelvin** [Junior Developer] - mmesomakelvin@gmail.com
 *
 * @param content - File content to parse
 * @returns Array of parsed contact entries
 */
export function parseContactsFile(content: string): ContactEntry[] {
  const contacts: ContactEntry[] = [];
  const lines = content.split('\n');

  // Regex pattern: - **Name** [Role] - email@example.com
  // Role is optional: - **Name** - email@example.com
  const contactPattern = /^-\s+\*\*([^*]+)\*\*(?:\s+\[([^\]]+)\])?\s+-\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(contactPattern);
    if (match) {
      const [, displayName, role, email] = match;
      if (displayName && email) {
        const entry: ContactEntry = {
          name: displayName.toLowerCase(), // For case-insensitive matching
          displayName: displayName,
          email: email.trim(),
        };
        if (role) {
          entry.role = role.trim();
        }
        contacts.push(entry);
      }
    }
  }

  return contacts;
}

/**
 * Load and parse contacts from PAI contacts file
 *
 * @param logger - Winston logger
 * @returns Map of contact name (lowercase) to contact entry
 */
async function loadContacts(logger: Logger): Promise<Map<string, ContactEntry>> {
  const contactsPath = process.env.PAI_CONTACTS_PATH || DEFAULT_CONTACTS_PATH;
  const contactsMap = new Map<string, ContactEntry>();

  try {
    const content = await fs.readFile(contactsPath, 'utf-8');
    const contacts = parseContactsFile(content);

    // Build map with lowercase names as keys
    for (const contact of contacts) {
      // Handle duplicates: keep first occurrence, warn about duplicates
      if (contactsMap.has(contact.name)) {
        logger.warn('Duplicate contact name found, using first occurrence', {
          name: contact.displayName,
          email1: contactsMap.get(contact.name)?.email,
          email2: contact.email,
        });
      } else {
        contactsMap.set(contact.name, contact);
      }
    }

    logger.info('Loaded PAI contacts', {
      path: contactsPath,
      count: contactsMap.size,
    });

    return contactsMap;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn('PAI contacts file not found, will treat all inputs as raw emails', {
        path: contactsPath,
        error: (error as Error).message,
      });
      return contactsMap; // Return empty map
    }

    logger.error('Error loading PAI contacts file', {
      path: contactsPath,
      error: (error as Error).message,
    });
    return contactsMap; // Return empty map on parse errors
  }
}

/**
 * Resolve contact names to email addresses from PAI contact list
 *
 * Supports:
 * - First names: "Mary" -> "findsbymary@gmail.com"
 * - Raw emails: "user@example.com" -> "user@example.com"
 * - Mixed: ["Mary", "user@example.com"] -> ["findsbymary@gmail.com", "user@example.com"]
 * - Case-insensitive: "mary", "MARY", "Mary" all resolve to same contact
 *
 * @param names - Array of contact names or email addresses
 * @param logger - Winston logger
 * @returns Array of resolved contacts with email and metadata
 * @throws Error if unknown contact name found
 */
export async function resolveContacts(
  names: string[],
  logger: Logger
): Promise<ResolvedContact[]> {
  const contactsMap = await loadContacts(logger);
  const resolved: ResolvedContact[] = [];

  for (const name of names) {
    const trimmed = name.trim();

    // Check if it's a valid email address
    if (EMAIL_REGEX.test(trimmed)) {
      // Pass through raw email (no displayName or role for raw emails)
      resolved.push({
        email: trimmed,
      });
      continue;
    }

    // Try to resolve as contact name (case-insensitive)
    const lowerName = trimmed.toLowerCase();
    const contact = contactsMap.get(lowerName);

    if (contact) {
      // Found in contacts
      const resolved_contact: ResolvedContact = {
        email: contact.email,
        displayName: contact.displayName,
      };
      if (contact.role) {
        resolved_contact.role = contact.role;
      }
      resolved.push(resolved_contact);
    } else {
      // Unknown contact and not a valid email
      if (contactsMap.size === 0) {
        // No contacts loaded, treat as raw email (fallback mode)
        logger.warn('No contacts loaded, treating input as raw email', {
          input: trimmed,
        });
        resolved.push({
          email: trimmed,
        });
      } else {
        // Contacts exist but this name not found - throw error
        const availableContacts = Array.from(contactsMap.values())
          .map((c) => c.displayName)
          .sort()
          .join(', ');

        throw new Error(
          `Contact '${trimmed}' not found in PAI contact list. Available contacts: ${availableContacts}`
        );
      }
    }
  }

  return resolved;
}
