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
    // Clear keys from memory and reset singleton
    keyRotationManager.clearKeys();
    (KeyRotationManager as any)._instance = undefined;
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
      expect(mockLogger.info).toHaveBeenCalledWith('Registered new key version', { version: 'v1' });
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

    it('should throw error for invalid version format', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'invalid',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('invalid', key, metadata);
      }).toThrow('Version must be in format "v1", "v2", etc.');
    });

    it('should throw error for empty version', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: '',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('', key, metadata);
      }).toThrow('Version must be in format "v1", "v2", etc.');
    });

    it('should throw error for non-Buffer key', () => {
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', 'not-a-buffer' as any, metadata);
      }).toThrow('Key must be a Buffer');
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

    it('should throw error for invalid metadata', () => {
      const key = crypto.randomBytes(32);

      expect(() => {
        keyRotationManager.registerKey('v1', key, null as any);
      }).toThrow('Invalid metadata object');

      expect(() => {
        keyRotationManager.registerKey('v1', key, 'not-an-object' as any);
      }).toThrow('Invalid metadata object');
    });

    it('should throw error for metadata version mismatch', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v2', // Mismatched version
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).toThrow('Metadata version must match registration version');
    });

    it('should throw error for unsupported algorithm', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-128-cbc', // Unsupported
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).toThrow('Only aes-256-gcm algorithm is supported');
    });

    it('should throw error for missing algorithm', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: '', // Empty algorithm
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).toThrow('Only aes-256-gcm algorithm is supported');
    });

    it('should throw error for insufficient iterations', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 50000, // Too low
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).toThrow('Iterations must be at least 100000');
    });

    it('should throw error for zero iterations', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 0,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).toThrow('Iterations must be at least 100000');
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

  describe('getKey', () => {
    it('should return key for existing version', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key, metadata);
      const retrievedKey = keyRotationManager.getKey('v1');

      expect(retrievedKey).toEqual({
        version: 'v1',
        key,
        metadata,
      });
    });

    it('should return undefined for non-existent version', () => {
      const retrievedKey = keyRotationManager.getKey('v999');
      expect(retrievedKey).toBeUndefined();
    });
  });

  describe('getKeyMetadata', () => {
    it('should return metadata for existing version', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v1', key, metadata);
      const retrievedMetadata = keyRotationManager.getKeyMetadata('v1');

      expect(retrievedMetadata).toEqual(metadata);
    });

    it('should return undefined for non-existent version', () => {
      const retrievedMetadata = keyRotationManager.getKeyMetadata('v999');
      expect(retrievedMetadata).toBeUndefined();
    });
  });

  describe('hasVersion', () => {
    it('should return true for existing version', () => {
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
    });

    it('should return false for non-existent version', () => {
      expect(keyRotationManager.hasVersion('v999')).toBe(false);
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
      expect(mockLogger.info).toHaveBeenCalledWith('Cleared all keys from memory');
    });

    it('should handle clearing empty key store', () => {
      keyRotationManager.clearKeys();

      expect(keyRotationManager.getVersions().length).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleared all keys from memory');
    });
  });

  describe('concurrent access and edge cases', () => {
    it('should handle multiple key registrations in sequence', () => {
      const keys = [crypto.randomBytes(32), crypto.randomBytes(32), crypto.randomBytes(32)];
      const versions = ['v1', 'v2', 'v3'];

      versions.forEach((version, index) => {
        const metadata: KeyMetadata = {
          version,
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64'),
        };
        const key = keys[index];
        if (!key) {throw new Error(`Key at index ${index} should be defined`);}
        keyRotationManager.registerKey(version, key, metadata);
      });

      expect(keyRotationManager.getVersions()).toEqual(expect.arrayContaining(versions));
      expect(keyRotationManager.getVersions().length).toBe(3);
    });

    it('should maintain singleton across multiple getInstance calls', () => {
      const anotherMockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
      } as any;

      const instance1 = KeyRotationManager.getInstance(mockLogger);
      const instance2 = KeyRotationManager.getInstance(anotherMockLogger);
      
      expect(instance1).toBe(instance2);
      
      // Register key with first instance
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };
      
      instance1.registerKey('v1', key, metadata);
      
      // Verify second instance sees the same key
      expect(instance2.hasVersion('v1')).toBe(true);
    });

    it('should properly handle version ordering', () => {
      const versions = ['v10', 'v2', 'v1', 'v3'];
      
      versions.forEach(version => {
        const key = crypto.randomBytes(32);
        const metadata: KeyMetadata = {
          version,
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64'),
        };
        keyRotationManager.registerKey(version, key, metadata);
      });

      const retrievedVersions = keyRotationManager.getVersions();
      expect(retrievedVersions).toEqual(expect.arrayContaining(versions));
      expect(retrievedVersions.length).toBe(4);
    });

    it('should handle large key versions correctly', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v999',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000,
        salt: crypto.randomBytes(32).toString('base64'),
      };

      keyRotationManager.registerKey('v999', key, metadata);
      keyRotationManager.setCurrentVersion('v999');

      expect(keyRotationManager.getCurrentKey().version).toBe('v999');
    });

    it('should handle minimum valid PBKDF2 iterations', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 100000, // Exactly minimum
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).not.toThrow();

      expect(keyRotationManager.hasVersion('v1')).toBe(true);
    });

    it('should handle high PBKDF2 iterations', () => {
      const key = crypto.randomBytes(32);
      const metadata: KeyMetadata = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: 1000000, // Very high but valid
        salt: crypto.randomBytes(32).toString('base64'),
      };

      expect(() => {
        keyRotationManager.registerKey('v1', key, metadata);
      }).not.toThrow();

      expect(keyRotationManager.getKeyMetadata('v1')?.iterations).toBe(1000000);
    });
  });
});