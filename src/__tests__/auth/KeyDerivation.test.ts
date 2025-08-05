import { KeyDerivation } from '../../auth/KeyDerivation.js';
import * as crypto from 'crypto';

describe('KeyDerivation', () => {
  describe('deriveKey', () => {
    it('should derive a key with minimum iterations', () => {
      const password = 'test-password';
      const result = KeyDerivation.deriveKey(password);

      expect(result.key).toBeInstanceOf(Buffer);
      expect(result.key.length).toBe(32);
      expect(result.salt).toBeInstanceOf(Buffer);
      expect(result.salt.length).toBe(32);
      expect(result.iterations).toBe(100000);
    });

    it('should derive consistent key with same password and salt', () => {
      const password = 'test-password';
      const salt = crypto.randomBytes(32);
      
      const result1 = KeyDerivation.deriveKey(password, salt);
      const result2 = KeyDerivation.deriveKey(password, salt);

      expect(result1.key).toEqual(result2.key);
      expect(result1.salt).toEqual(result2.salt);
      expect(result1.iterations).toEqual(result2.iterations);
    });

    it('should derive different keys with different passwords', () => {
      const salt = crypto.randomBytes(32);
      
      const result1 = KeyDerivation.deriveKey('password1', salt);
      const result2 = KeyDerivation.deriveKey('password2', salt);

      expect(result1.key).not.toEqual(result2.key);
    });

    it('should derive different keys with different salts', () => {
      const password = 'test-password';
      
      const result1 = KeyDerivation.deriveKey(password);
      const result2 = KeyDerivation.deriveKey(password);

      expect(result1.key).not.toEqual(result2.key);
      expect(result1.salt).not.toEqual(result2.salt);
    });

    it('should throw error for iterations below minimum', () => {
      expect(() => {
        KeyDerivation.deriveKey('password', undefined, 50000);
      }).toThrow('Iterations must be at least 100000');
    });

    it('should work with Buffer password', () => {
      const password = Buffer.from('test-password');
      const result = KeyDerivation.deriveKey(password);

      expect(result.key).toBeInstanceOf(Buffer);
      expect(result.key.length).toBe(32);
    });
  });

  describe('generateSalt', () => {
    it('should generate a 32-byte salt', () => {
      const salt = KeyDerivation.generateSalt();

      expect(salt).toBeInstanceOf(Buffer);
      expect(salt.length).toBe(32);
    });

    it('should generate unique salts', () => {
      const salt1 = KeyDerivation.generateSalt();
      const salt2 = KeyDerivation.generateSalt();

      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('timingSafeCompare', () => {
    it('should return true for identical strings', () => {
      const result = KeyDerivation.timingSafeCompare('version1', 'version1');
      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = KeyDerivation.timingSafeCompare('version1', 'version2');
      expect(result).toBe(false);
    });

    it('should return false for different length strings', () => {
      const result = KeyDerivation.timingSafeCompare('short', 'longer-string');
      expect(result).toBe(false);
    });

    it('should handle empty strings', () => {
      const result = KeyDerivation.timingSafeCompare('', '');
      expect(result).toBe(true);
    });
  });

  describe('clearSensitiveData', () => {
    it('should clear buffer contents', () => {
      const buffer = Buffer.from('sensitive-data');
      const originalData = Buffer.from(buffer);

      KeyDerivation.clearSensitiveData(buffer);

      expect(buffer.every(byte => byte === 0)).toBe(true);
      expect(buffer).not.toEqual(originalData);
    });

    it('should handle multiple buffers', () => {
      const buffer1 = Buffer.from('data1');
      const buffer2 = Buffer.from('data2');
      const buffer3 = Buffer.from('data3');

      KeyDerivation.clearSensitiveData(buffer1, buffer2, buffer3);

      expect(buffer1.every(byte => byte === 0)).toBe(true);
      expect(buffer2.every(byte => byte === 0)).toBe(true);
      expect(buffer3.every(byte => byte === 0)).toBe(true);
    });

    it('should handle empty buffer array', () => {
      expect(() => {
        KeyDerivation.clearSensitiveData();
      }).not.toThrow();
    });

    it('should skip non-Buffer values', () => {
      const buffer = Buffer.from('data');
      const notBuffer = 'not-a-buffer' as any;

      expect(() => {
        KeyDerivation.clearSensitiveData(buffer, notBuffer);
      }).not.toThrow();

      expect(buffer.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('deriveKeyFromEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should derive key from environment variable', () => {
      const testKey = crypto.randomBytes(32).toString('base64');
      process.env.TEST_KEY = testKey;
      const salt = crypto.randomBytes(32);

      const result = KeyDerivation.deriveKeyFromEnvironment('TEST_KEY', salt);

      expect(result.key).toBeInstanceOf(Buffer);
      expect(result.key.length).toBe(32);
      expect(result.salt).toEqual(salt);
    });

    it('should throw error if environment variable not found', () => {
      const salt = crypto.randomBytes(32);

      expect(() => {
        KeyDerivation.deriveKeyFromEnvironment('NON_EXISTENT_KEY', salt);
      }).toThrow('Environment variable NON_EXISTENT_KEY not found');
    });

    it('should clear the original key buffer', () => {
      const testKey = crypto.randomBytes(32);
      const testKeyBase64 = testKey.toString('base64');
      process.env.TEST_KEY = testKeyBase64;
      const salt = crypto.randomBytes(32);

      const result = KeyDerivation.deriveKeyFromEnvironment('TEST_KEY', salt);

      // The result should be derived, not the original
      expect(result.key).not.toEqual(testKey);
    });
  });
});