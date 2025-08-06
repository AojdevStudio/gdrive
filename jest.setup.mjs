// Jest setup file for test environment configuration
/* eslint-env node */
import { jest } from '@jest/globals';
import crypto from 'crypto';

// Set test environment variables
globalThis.process.env.NODE_ENV = 'test';
globalThis.process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
globalThis.process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = globalThis.Buffer.from(crypto.randomBytes(32)).toString('base64'); // Test encryption key

// Mock winston to prevent file writes during tests
jest.mock('winston', () => {
  const originalWinston = jest.requireActual('winston');
  return {
    ...originalWinston,
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      silly: jest.fn(),
      log: jest.fn(),
    })),
  };
});

// Global test timeout
jest.setTimeout(10000);