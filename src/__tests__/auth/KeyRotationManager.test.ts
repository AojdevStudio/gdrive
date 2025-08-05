import { KeyRotationManager, KeyMetadata } from '../../auth/KeyRotationManager.js';
import { Logger } from 'winston';
import * as crypto from 'crypto';

describe('KeyRotationManager', () => {
  let keyRotationManager: KeyRotationManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Clear singleton instance
    (KeyRotationManager as any)._instance = undefined;
    keyRotationManager = KeyRotationManager.getInstance(mockLogger);
  });

  afterEach(() => {
    // Clear keys from memory
    keyRotationManager.clearKeys();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = KeyRotationManager.getInstance(mockLogger);
      const instance2 = KeyRotationManager.getInstance(mockLogger);
      expect(instance1).toBe(instance2);
    });
  });

  describe('registerKey', () => {
    it('should register a new key version', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key, metadata);

      expect(keyRotationManager.hasVersion('v1')).toBe(true);
      expect(keyRotationManager.getKey('v1')).toEqual({
        version: 'v1',
        key,
        metadata,
      });
    });

    it('should throw error for duplicate key version', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key, metadata);

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).toThrow('Key version v1 already registered');
    });

    it('should throw error for invalid key length', () => {
      const key = crypto.randomBytes(16); // Wrong size
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).toThrow('Key must be 32 bytes for AES-256');
    });
  });

  describe('getCurrentKey', () => {
    it('should return current key version', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key, metadata);
      
      const currentKey = keyRotationManager.getCurrentKey();
      expect(currentKey.version).toBe('v1');
      expect(currentKey.key).toEqual(key);
    });

    it('should throw error if current key not found', () => {
      expect(() => {
        keyRotationManager.getCurrentKey();
      }).toThrow('Current key version v1 not found');
    });
  });

  describe('setCurrentVersion', () => {
    it('should update current key version', () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      const metadata1: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };
      const metadata2: KeyMetadata = {
        version: 'v2',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key1, metadata1);
      keyRotationManager.registerKey('v2', key2, metadata2);
      
      keyRotationManager.setCurrentVersion('v2');
      
      const currentKey = keyRotationManager.getCurrentKey();
      expect(currentKey.version).toBe('v2');
    });

    it('should throw error for non-existent version', () => {
      expect(() => {
        keyRotationManager.setCurrentVersion('v2');
      }).toThrow('Key version v2 not registered');
    });
  });

  describe('getVersions', () => {
    it('should return all registered key versions', () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key1, metadata);
      keyRotationManager.registerKey('v2', key2, { ...metadata, version: 'v2' });

      const versions = keyRotationManager.getVersions();
      expect(versions).toContain('v1');
      expect(versions).toContain('v2');
      expect(versions.length).toBe(2);
    });
  });

  describe('clearKeys', () => {
    it('should clear all keys from memory', () => {
      const key = crypto.randomBytes(32);
      const originalKey = Buffer.from(key);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key, metadata);
      keyRotationManager.clearKeys();

      expect(keyRotationManager.hasVersion('v1')).toBe(false);
      expect(keyRotationManager.getVersions().length).toBe(0);
      
      // Verify key buffer was cleared
      expect(key.every(byte => byte === 0)).toBe(true);
      expect(key).not.toEqual(originalKey);
    });
  });
});