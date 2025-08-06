// Jest setup file for test environment configuration
const crypto = require('crypto');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = Buffer.from(crypto.randomBytes(32)).toString('base64'); // Test encryption key

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

// Mock Google APIs to prevent real API calls during tests
jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({
      files: {
        list: jest.fn(),
        get: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        export: jest.fn(),
      },
    })),
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: jest.fn(),
          update: jest.fn(),
          append: jest.fn(),
        },
      },
    })),
    forms: jest.fn(() => ({
      forms: {
        create: jest.fn(),
        get: jest.fn(),
        batchUpdate: jest.fn(),
      },
    })),
    docs: jest.fn(() => ({
      documents: {
        create: jest.fn(),
        get: jest.fn(),
        batchUpdate: jest.fn(),
      },
    })),
  },
}));

// Mock Redis client to prevent real Redis connections during tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    flushall: jest.fn(),
    on: jest.fn(),
    ping: jest.fn(),
  })),
}));

// Global test timeout
jest.setTimeout(10000);

// Type-safe mock helper to avoid TypeScript compilation errors
global.createMockFunction = (implementation) => {
  return jest.fn(implementation);
};

// Global type declarations for test environment
global.mockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
});

global.mockCrypto = {
  randomBytes: jest.fn(),
  pbkdf2Sync: jest.fn(),
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
  timingSafeEqual: jest.fn(),
};

// Global test cleanup to prevent hanging worker processes
let activeTimers = new Set();
let activeProcesses = new Set();

// Track timers
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

global.setTimeout = function(callback, delay, ...args) {
  const id = originalSetTimeout(callback, delay, ...args);
  activeTimers.add(id);
  return id;
};

global.setInterval = function(callback, delay, ...args) {
  const id = originalSetInterval(callback, delay, ...args);
  activeTimers.add(id);
  return id;
};

global.clearTimeout = function(id) {
  activeTimers.delete(id);
  return originalClearTimeout(id);
};

global.clearInterval = function(id) {
  activeTimers.delete(id);
  return originalClearInterval(id);
};

// Cleanup after each test
afterEach(() => {
  // Clear any remaining timers
  for (const timerId of activeTimers) {
    originalClearTimeout(timerId);
    originalClearInterval(timerId);
  }
  activeTimers.clear();
  
  // Clear any singleton instances that might hold references
  if (global.gc) {
    global.gc();
  }
});

// Final cleanup after all tests
afterAll(async () => {
  // Clear any remaining timers
  for (const timerId of activeTimers) {
    originalClearTimeout(timerId);
    originalClearInterval(timerId);
  }
  activeTimers.clear();
  
  // Give time for any async operations to complete
  await new Promise(resolve => originalSetTimeout(resolve, 100));
});