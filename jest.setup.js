// Jest setup file for test environment configuration
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = Buffer.from(new Uint8Array(32)).toString('base64'); // Test encryption key

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