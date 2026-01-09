/**
 * Tests for PAI contact resolution
 *
 * Following TDD approach per spec:
 * - Test contacts resolution with first names
 * - Test raw email addresses
 * - Test mixed inputs
 * - Test unknown contacts
 * - Test case-insensitive matching
 * - Test missing contacts file
 * - Test parse errors
 * - Test duplicate names
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import type { Logger } from 'winston';
import { resolveContacts, parseContactsFile } from '../contacts.js';

// Mock fs module
jest.mock('fs/promises');

const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

describe('resolveContacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any environment variable overrides
    delete process.env.PAI_CONTACTS_PATH;
  });

  describe('First name resolution', () => {
    it('should resolve first name to email address', async () => {
      // Setup: Mock contacts file with Mary
      const contactsContent = `- **Mary** [Wife/Life Partner] - findsbymary@gmail.com`;
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute
      const result = await resolveContacts(['Mary'], mockLogger);

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0]!).toEqual({
        email: 'findsbymary@gmail.com',
        displayName: 'Mary',
        role: 'Wife/Life Partner',
      });
    });

    it('should resolve multiple first names', async () => {
      // Setup
      const contactsContent = `
- **Mary** [Wife/Life Partner] - findsbymary@gmail.com
- **Kelvin** [Junior Developer] - mmesomakelvin@gmail.com
- **Giauna** [Daughter] - giauna@example.com
      `.trim();
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute
      const result = await resolveContacts(['Mary', 'Kelvin'], mockLogger);

      // Verify
      expect(result).toHaveLength(2);
      expect(result[0]!.email).toBe('findsbymary@gmail.com');
      expect(result[1]!.email).toBe('mmesomakelvin@gmail.com');
    });

    it('should handle case-insensitive matching', async () => {
      // Setup
      const contactsContent = `- **Mary** [Wife/Life Partner] - findsbymary@gmail.com`;
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute: Test lowercase, uppercase, mixed case
      const result1 = await resolveContacts(['mary'], mockLogger);
      const result2 = await resolveContacts(['MARY'], mockLogger);
      const result3 = await resolveContacts(['MaRy'], mockLogger);

      // Verify: All should resolve to same contact
      expect(result1[0]!.email).toBe('findsbymary@gmail.com');
      expect(result2[0]!.email).toBe('findsbymary@gmail.com');
      expect(result3[0]!.email).toBe('findsbymary@gmail.com');
    });
  });

  describe('Raw email addresses', () => {
    it('should pass through valid email addresses unchanged', async () => {
      // Setup: Empty contacts file
      mockReadFile.mockResolvedValue('');

      // Execute
      const result = await resolveContacts(['user@example.com'], mockLogger);

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        email: 'user@example.com',
        displayName: undefined,
        role: undefined,
      });
    });

    it('should handle multiple raw emails', async () => {
      // Setup
      mockReadFile.mockResolvedValue('');

      // Execute
      const result = await resolveContacts(
        ['alice@example.com', 'bob@company.org', 'charlie@test.io'],
        mockLogger
      );

      // Verify
      expect(result).toHaveLength(3);
      expect(result[0]!.email).toBe('alice@example.com');
      expect(result[1]!.email).toBe('bob@company.org');
      expect(result[2]!.email).toBe('charlie@test.io');
    });
  });

  describe('Mixed inputs', () => {
    it('should handle mix of names and emails', async () => {
      // Setup
      const contactsContent = `
- **Mary** [Wife/Life Partner] - findsbymary@gmail.com
- **Kelvin** [Junior Developer] - mmesomakelvin@gmail.com
      `.trim();
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute
      const result = await resolveContacts(
        ['Mary', 'external@company.com', 'Kelvin', 'another@test.org'],
        mockLogger
      );

      // Verify
      expect(result).toHaveLength(4);
      expect(result[0]!.email).toBe('findsbymary@gmail.com');
      expect(result[1]!.email).toBe('external@company.com');
      expect(result[2]!.email).toBe('mmesomakelvin@gmail.com');
      expect(result[3]!.email).toBe('another@test.org');
    });
  });

  describe('Unknown contacts', () => {
    it('should throw error for unknown contact name', async () => {
      // Setup
      const contactsContent = `
- **Mary** [Wife/Life Partner] - findsbymary@gmail.com
- **Kelvin** [Junior Developer] - mmesomakelvin@gmail.com
      `.trim();
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute & Verify
      await expect(
        resolveContacts(['Bob'], mockLogger)
      ).rejects.toThrow(/Contact 'Bob' not found in PAI contact list/);
    });

    it('should list available contacts in error message', async () => {
      // Setup
      const contactsContent = `
- **Mary** [Wife/Life Partner] - findsbymary@gmail.com
- **Kelvin** [Junior Developer] - mmesomakelvin@gmail.com
- **Giauna** [Daughter] - giauna@example.com
      `.trim();
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute & Verify: Contacts are sorted alphabetically
      await expect(
        resolveContacts(['UnknownPerson'], mockLogger)
      ).rejects.toThrow(/Available contacts: Giauna, Kelvin, Mary/);
    });
  });

  describe('Missing contacts file', () => {
    it('should fallback to treating all inputs as emails when file missing', async () => {
      // Setup: Simulate file not found error
      mockReadFile.mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file or directory'), {
          code: 'ENOENT',
        })
      );

      // Execute
      const result = await resolveContacts(
        ['Mary', 'user@example.com'],
        mockLogger
      );

      // Verify: Both treated as raw emails when contacts file unavailable
      expect(result).toHaveLength(2);
      expect(result[0]!.email).toBe('Mary');
      expect(result[1]!.email).toBe('user@example.com');

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('PAI contacts file not found'),
        expect.any(Object)
      );
    });
  });

  describe('Environment variable', () => {
    it('should use PAI_CONTACTS_PATH environment variable if set', async () => {
      // Setup
      process.env.PAI_CONTACTS_PATH = '/custom/path/contacts.md';
      const contactsContent = `- **Mary** [Wife] - mary@example.com`;
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute
      await resolveContacts(['Mary'], mockLogger);

      // Verify: Should read from custom path
      expect(mockReadFile).toHaveBeenCalledWith('/custom/path/contacts.md', 'utf-8');
    });

    it('should use default path when environment variable not set', async () => {
      // Setup: No PAI_CONTACTS_PATH set
      const contactsContent = `- **Mary** [Wife] - mary@example.com`;
      mockReadFile.mockResolvedValue(contactsContent);

      // Execute
      await resolveContacts(['Mary'], mockLogger);

      // Verify: Should read from default path
      expect(mockReadFile).toHaveBeenCalledWith(
        '/Users/ossieirondi/PAI/.claude/skills/CORE/USER/CONTACTS.md',
        'utf-8'
      );
    });
  });
});

describe('parseContactsFile', () => {
  it('should parse standard contact format', () => {
    // Setup
    const content = `
# My Contacts

- **Mary** [Wife/Life Partner] - findsbymary@gmail.com
- **Kelvin** [Junior Developer] - mmesomakelvin@gmail.com
    `.trim();

    // Execute
    const contacts = parseContactsFile(content);

    // Verify
    expect(contacts).toHaveLength(2);
    expect(contacts[0]!).toEqual({
      name: 'mary',
      displayName: 'Mary',
      email: 'findsbymary@gmail.com',
      role: 'Wife/Life Partner',
    });
    expect(contacts[1]!).toEqual({
      name: 'kelvin',
      displayName: 'Kelvin',
      email: 'mmesomakelvin@gmail.com',
      role: 'Junior Developer',
    });
  });

  it('should handle contacts without roles', () => {
    // Setup
    const content = `- **Alice** - alice@example.com`;

    // Execute
    const contacts = parseContactsFile(content);

    // Verify
    expect(contacts).toHaveLength(1);
    expect(contacts[0]!).toEqual({
      name: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      role: undefined,
    });
  });

  it('should skip invalid lines', () => {
    // Setup: Mix of valid and invalid lines
    const content = `
- **Mary** [Wife] - mary@example.com
This is not a valid contact line
- Invalid format
- **Bob** [Friend] - bob@example.com
    `.trim();

    // Execute
    const contacts = parseContactsFile(content);

    // Verify: Only valid lines parsed
    expect(contacts).toHaveLength(2);
    expect(contacts[0]!.displayName).toBe('Mary');
    expect(contacts[1]!.displayName).toBe('Bob');
  });

  it('should handle duplicate names by keeping first occurrence', () => {
    // Setup
    const content = `
- **Mary** [Wife] - mary1@example.com
- **Mary** [Friend] - mary2@example.com
    `.trim();

    // Execute
    const contacts = parseContactsFile(content);

    // Verify: Both entries present (deduplication happens in resolveContacts)
    expect(contacts).toHaveLength(2);
    expect(contacts[0]!.email).toBe('mary1@example.com');
    expect(contacts[1]!.email).toBe('mary2@example.com');
  });

  it('should handle empty content', () => {
    // Execute
    const contacts = parseContactsFile('');

    // Verify
    expect(contacts).toHaveLength(0);
  });

  it('should handle whitespace-only content', () => {
    // Execute
    const contacts = parseContactsFile('   \n\n  \t  \n   ');

    // Verify
    expect(contacts).toHaveLength(0);
  });
});
