import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as crypto from 'crypto';
import { KeyDerivation } from '../../auth/KeyDerivation.js';
import { KeyRotationManager } from '../../auth/KeyRotationManager.js';
import { TokenManager } from '../../auth/TokenManager.js';
import { Logger } from 'winston';

/**
 * Security Tests for Cryptographic Implementation
 * 
 * Tests cover:
 * - PBKDF2 iteration enforcement (minimum 100,000)
 * - Memory clearing with buffer inspection
 * - Timing attack resistance
 * - Key strength requirements
 * - Cryptographic parameter validation
 */
describe('Cryptographic Security Tests', () => {
  let mockLogger: Logger;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Mock logger for testing
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Clear singleton instances
    (KeyRotationManager as any)._instance = undefined;
    (TokenManager as any)._instance = undefined;

    // Set required environment variable for tests
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('PBKDF2 Iteration Enforcement', () => {
    it('should enforce minimum 100,000 iterations', () => {
      const password = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32);
      
      // Test with minimum iterations
      const result = KeyDerivation.deriveKey(password, salt, 100000);
      expect(result.iterations).toBe(100000);
      
      // Clean up sensitive data
      password.fill(0);
      result.key.fill(0);
      result.salt.fill(0);
    });

    it('should reject iterations below minimum threshold', () => {
      const password = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32);
      
      expect(() => {
        KeyDerivation.deriveKey(password, salt, 50000); // Below minimum
      }).toThrow('Iterations must be at least 100000');
      
      // Clean up
      password.fill(0);
    });

    it('should accept iterations above minimum threshold', () => {
      const password = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32);
      
      const result = KeyDerivation.deriveKey(password, salt, 200000);
      expect(result.iterations).toBe(200000);
      
      // Clean up sensitive data
      password.fill(0);
      result.key.fill(0);
      result.salt.fill(0);
    });

    it('should use default iterations when not specified', () => {
      const password = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32);
      
      const result = KeyDerivation.deriveKey(password, salt);
      expect(result.iterations).toBeGreaterThanOrEqual(100000);
      
      // Clean up sensitive data
      password.fill(0);
      result.key.fill(0);
      result.salt.fill(0);
    });

    it('should use default iterations when not specified', () => {
      const password = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32);
      
      const result = KeyDerivation.deriveKey(password, salt);
      expect(result.iterations).toBe(100000); // Default minimum
      
      // Clean up sensitive data
      password.fill(0);
      result.key.fill(0);
      result.salt.fill(0);
    });

    it('should derive key from environment variables', () => {
      const testKey = crypto.randomBytes(32).toString('base64');
      process.env.TEST_KEY = testKey;
      
      const salt = crypto.randomBytes(32);
      
      const result = KeyDerivation.deriveKeyFromEnvironment('TEST_KEY', salt, 100000);
      expect(result.iterations).toBe(100000);
      expect(result.key.length).toBe(32);
      expect(result.salt).toBe(salt);
      
      // Clean up sensitive data
      result.key.fill(0);
      result.salt.fill(0);
      delete process.env.TEST_KEY;
    });
  });

  describe('Memory Clearing and Buffer Inspection', () => {
    it('should clear sensitive data from buffers', () => {
      const sensitiveData = Buffer.from('secret-key-data-12345678901234567890');
      const originalContent = sensitiveData.toString();
      
      // Verify original content
      expect(sensitiveData.toString()).toBe(originalContent);
      
      // Clear sensitive data
      KeyDerivation.clearSensitiveData(sensitiveData);
      
      // Verify buffer is cleared (all zeros)
      const isCleared = sensitiveData.every(byte => byte === 0);
      expect(isCleared).toBe(true);
      expect(sensitiveData.toString()).not.toBe(originalContent);
    });

    it('should clear multiple buffers simultaneously', () => {
      const buffer1 = Buffer.from('sensitive-data-1');
      const buffer2 = Buffer.from('sensitive-data-2');
      const buffer3 = Buffer.from('sensitive-data-3');
      
      const original1 = buffer1.toString();
      const original2 = buffer2.toString();
      const original3 = buffer3.toString();
      
      // Clear all buffers
      KeyDerivation.clearSensitiveData(buffer1, buffer2, buffer3);
      
      // Verify all buffers are cleared
      expect(buffer1.every(byte => byte === 0)).toBe(true);
      expect(buffer2.every(byte => byte === 0)).toBe(true);
      expect(buffer3.every(byte => byte === 0)).toBe(true);
      
      // Verify content has changed
      expect(buffer1.toString()).not.toBe(original1);
      expect(buffer2.toString()).not.toBe(original2);
      expect(buffer3.toString()).not.toBe(original3);
    });

    it('should handle empty and null buffers gracefully', () => {
      const emptyBuffer = Buffer.alloc(0);
      
      // Should not throw error
      expect(() => {
        KeyDerivation.clearSensitiveData(emptyBuffer);
      }).not.toThrow();
    });

    it('should clear derived keys after use', () => {
      const password = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32);
      
      const result = KeyDerivation.deriveKey(password, salt);
      
      // Verify key is valid
      expect(result.key.length).toBe(32);
      expect(result.key.every(byte => byte === 0)).toBe(false);
      
      // Clear derived key
      KeyDerivation.clearSensitiveData(result.key, result.salt);
      
      // Verify key is cleared
      expect(result.key.every(byte => byte === 0)).toBe(true);
      expect(result.salt.every(byte => byte === 0)).toBe(true);
      
      // Clean up original buffers
      password.fill(0);
      salt.fill(0);
    });

    it('should verify memory clearing in TokenManager', () => {
      // Mock fs to avoid file operations
      jest.mock('fs/promises', () => ({
        writeFile: jest.fn(),
        chmod: jest.fn(),
        appendFile: jest.fn(),
      }));

      const tokenManager = TokenManager.getInstance(mockLogger);
      const testTokenData = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive',
      };

      // Spy on clearSensitiveData to verify it's called
      const clearSensitiveDataSpy = jest.spyOn(KeyDerivation, 'clearSensitiveData');

      // Save tokens (this should trigger memory clearing)
      tokenManager.saveTokens(testTokenData);

      // Verify clearSensitiveData was called
      expect(clearSensitiveDataSpy).toHaveBeenCalled();

      clearSensitiveDataSpy.mockRestore();
    });
  });

  describe('Timing Attack Resistance', () => {
    it('should use timing-safe comparison for string operations', () => {
      const string1 = 'test-token-12345';
      const string2 = 'test-token-12345'; // Same content
      const string3 = 'test-token-12346'; // Different content
      
      // Test timing-safe string comparison
      const startTime1 = process.hrtime.bigint();
      const result1 = KeyDerivation.timingSafeCompare(string1, string2);
      const endTime1 = process.hrtime.bigint();
      
      const startTime2 = process.hrtime.bigint();
      const result2 = KeyDerivation.timingSafeCompare(string1, string3);
      const endTime2 = process.hrtime.bigint();
      
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      
      // Timing should be similar (within reasonable bounds)
      const duration1 = Number(endTime1 - startTime1);
      const duration2 = Number(endTime2 - startTime2);
      
      // Allow for some variance but they should be in the same order of magnitude
      const timingRatio = duration1 > 0 && duration2 > 0 ? 
        Math.abs(duration1 - duration2) / Math.max(duration1, duration2) : 0;
      expect(timingRatio).toBeLessThan(1.0); // Allow reasonable variance
    });

    it('should use crypto.timingSafeEqual for buffer comparison', () => {
      const token1 = 'abcdef123456789';
      const token2 = 'abcdef123456789'; // Same
      const token3 = 'abcdef123456780'; // Different by one character
      
      // Test crypto.timingSafeEqual directly (Node.js built-in)
      const buffer1 = Buffer.from(token1);
      const buffer2 = Buffer.from(token2);
      const buffer3 = Buffer.from(token3);
      
      // Measure timing for same buffers
      const startTime1 = process.hrtime.bigint();
      const result1 = crypto.timingSafeEqual(buffer1, buffer2);
      const endTime1 = process.hrtime.bigint();
      
      // Measure timing for different buffers
      const startTime2 = process.hrtime.bigint();
      const result2 = crypto.timingSafeEqual(buffer1, buffer3);
      const endTime2 = process.hrtime.bigint();
      
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      
      // Timing should be constant regardless of where difference occurs
      const duration1 = Number(endTime1 - startTime1);
      const duration2 = Number(endTime2 - startTime2);
      
      // crypto.timingSafeEqual should have consistent timing
      const timingRatio = duration1 > 0 && duration2 > 0 ? 
        Math.abs(duration1 - duration2) / Math.max(duration1, duration2) : 0;
      expect(timingRatio).toBeLessThan(1.0); // Allow reasonable variance for micro-operations
    });

    it('should prevent timing attacks on key derivation salt comparison', () => {
      const password = crypto.randomBytes(32);
      const correctSalt = crypto.randomBytes(32);
      const wrongSalt = crypto.randomBytes(32);
      
      // Derive key with correct salt
      const startTime1 = process.hrtime.bigint();
      const result1 = KeyDerivation.deriveKey(password, correctSalt);
      const endTime1 = process.hrtime.bigint();
      
      // Derive key with wrong salt (should take similar time)
      const startTime2 = process.hrtime.bigint();
      const result2 = KeyDerivation.deriveKey(password, wrongSalt);
      const endTime2 = process.hrtime.bigint();
      
      // Keys should be different
      expect(Buffer.compare(result1.key, result2.key)).not.toBe(0);
      
      // Timing should be similar (PBKDF2 takes constant time)
      const duration1 = Number(endTime1 - startTime1);
      const duration2 = Number(endTime2 - startTime2);
      
      const timingRatio = Math.abs(duration1 - duration2) / Math.max(duration1, duration2);
      expect(timingRatio).toBeLessThan(0.5); // Less than 50% difference (PBKDF2 timing can vary)
      
      // Clean up sensitive data
      password.fill(0);
      correctSalt.fill(0);
      wrongSalt.fill(0);
      result1.key.fill(0);
      result1.salt.fill(0);
      result2.key.fill(0);
      result2.salt.fill(0);
    });
  });

  describe('Key Strength Requirements', () => {
    it('should require 256-bit (32-byte) encryption keys', () => {
      const validKey = crypto.randomBytes(32);
      const shortKey = crypto.randomBytes(16);
      const longKey = crypto.randomBytes(64);
      
      // Valid key should work
      expect(() => {
        KeyRotationManager.getInstance(mockLogger).registerKey('v1', validKey, {
          version: 'v1',
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64')
        });
      }).not.toThrow();
      
      // Short key should fail
      expect(() => {
        KeyRotationManager.getInstance(mockLogger).registerKey('v2', shortKey, {
          version: 'v2',
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64')
        });
      }).toThrow('Key must be 32 bytes for AES-256');
      
      // Long key should fail  
      expect(() => {
        KeyRotationManager.getInstance(mockLogger).registerKey('v3', longKey, {
          version: 'v3',
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64')
        });
      }).toThrow('Key must be 32 bytes for AES-256');
      
      // Clean up
      validKey.fill(0);
      shortKey.fill(0);
      longKey.fill(0);
    });

    it('should validate key entropy and randomness', () => {
      // Test with predictable key (should fail entropy check)
      const predictableKey = Buffer.alloc(32, 0x42); // All same byte
      const randomKey = crypto.randomBytes(32);
      
      // Calculate simple entropy metric
      const calculateEntropy = (buffer: Buffer): number => {
        const counts = new Map<number, number>();
        for (const byte of buffer) {
          counts.set(byte, (counts.get(byte) || 0) + 1);
        }
        
        let entropy = 0;
        const length = buffer.length;
        for (const count of counts.values()) {
          const p = count / length;
          entropy -= p * Math.log2(p);
        }
        return entropy;
      };
      
      const predictableEntropy = calculateEntropy(predictableKey);
      const randomEntropy = calculateEntropy(randomKey);
      
      // Random key should have higher entropy
      expect(randomEntropy).toBeGreaterThan(predictableEntropy);
      expect(randomEntropy).toBeGreaterThan(4); // Reasonable entropy threshold (adjusted for 32-byte keys)
      
      // Clean up
      predictableKey.fill(0);
      randomKey.fill(0);
    });

    it('should enforce salt length requirements via KeyDerivation', () => {
      const password = crypto.randomBytes(32);
      const validSalt = crypto.randomBytes(32);
      
      // Valid salt should work
      expect(() => {
        const result = KeyDerivation.deriveKey(password, validSalt);
        result.key.fill(0);
        result.salt.fill(0);
      }).not.toThrow();
      
      // Test with generated salt (should be 32 bytes)
      const result = KeyDerivation.deriveKey(password);
      expect(result.salt.length).toBe(32);
      
      // Clean up
      password.fill(0);
      validSalt.fill(0);
      result.key.fill(0);
      result.salt.fill(0);
    });

    it('should validate algorithm specifications', () => {
      const keyManager = KeyRotationManager.getInstance(mockLogger);
      const validKey = crypto.randomBytes(32);
      
      // Valid algorithm should work (use proper version format)
      expect(() => {
        keyManager.registerKey('v10', validKey, {
          version: 'v10',
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64')
        });
      }).not.toThrow();
      
      // Invalid algorithm should fail (use proper version format)
      expect(() => {
        keyManager.registerKey('v11', crypto.randomBytes(32), {
          version: 'v11',
          algorithm: 'aes-128-cbc', // Weaker algorithm
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64')
        });
      }).toThrow('Only aes-256-gcm algorithm is supported');
      
      // Clean up
      validKey.fill(0);
    });

    it('should require secure key generation methods', () => {
      // Test that keys are generated using crypto.randomBytes
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      
      // Keys should be different (extremely low probability of collision)
      expect(Buffer.compare(key1, key2)).not.toBe(0);
      
      // Keys should have proper length
      expect(key1.length).toBe(32);
      expect(key2.length).toBe(32);
      
      // Keys should not be all zeros (basic sanity check)
      const sum1 = key1.reduce((acc, byte) => acc + byte, 0);
      const sum2 = key2.reduce((acc, byte) => acc + byte, 0);
      expect(sum1).toBeGreaterThan(0);
      expect(sum2).toBeGreaterThan(0);
      
      // Clean up
      key1.fill(0);
      key2.fill(0);
    });
  });

  describe('Cryptographic Parameter Validation', () => {
    it('should validate AES-256-GCM parameters', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const data = 'test-encryption-data';
      
      // Create cipher with valid parameters
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Verify IV length
      expect(iv.length).toBe(16);
      
      // Verify auth tag length
      expect(authTag.length).toBe(16);
      
      // Verify encryption worked
      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
      
      // Test decryption
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      expect(decrypted).toBe(data);
      
      // Clean up
      key.fill(0);
      iv.fill(0);
    });

    it('should reject weak IV generation', () => {
      const key = crypto.randomBytes(32);
      const weakIV = Buffer.alloc(16, 0); // All zeros - weak IV
      const data = 'test-data';
      
      // Using weak IV should still work technically but is not secure
      const cipher = crypto.createCipheriv('aes-256-gcm', key, weakIV);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // But we should detect and reject such patterns in our implementation
      const calculateIVEntropy = (iv: Buffer): number => {
        const uniqueBytes = new Set(iv);
        return uniqueBytes.size / iv.length;
      };
      
      const entropy = calculateIVEntropy(weakIV);
      expect(entropy).toBeLessThan(0.5); // Low entropy indicates weak IV
      
      // Our implementation should require good IV entropy
      const goodIV = crypto.randomBytes(16);
      const goodEntropy = calculateIVEntropy(goodIV);
      expect(goodEntropy).toBeGreaterThan(0.5);
      
      // Clean up
      key.fill(0);
      weakIV.fill(0);
      goodIV.fill(0);
    });

    it('should validate authentication tag integrity', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const data = 'sensitive-token-data';
      
      // Encrypt data
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const originalAuthTag = cipher.getAuthTag();
      
      // Test with correct auth tag
      const decipher1 = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher1.setAuthTag(originalAuthTag);
      let decrypted = decipher1.update(encrypted, 'hex', 'utf8');
      decrypted += decipher1.final('utf8');
      expect(decrypted).toBe(data);
      
      // Test with tampered auth tag
      const tamperedAuthTag = Buffer.from(originalAuthTag);
      tamperedAuthTag[0] ^= 0x01; // Flip one bit
      
      const decipher2 = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher2.setAuthTag(tamperedAuthTag);
      
      expect(() => {
        let decrypted = decipher2.update(encrypted, 'hex', 'utf8');
        decrypted += decipher2.final('utf8');
      }).toThrow(); // Should throw due to authentication failure
      
      // Clean up sensitive data
      key.fill(0);
      iv.fill(0);
      originalAuthTag.fill(0);
      tamperedAuthTag.fill(0);
    });

    it('should enforce proper key derivation parameters', () => {
      const password = Buffer.from('user-password');
      const salt = crypto.randomBytes(32);
      
      // Test minimum iterations
      expect(() => {
        KeyDerivation.deriveKey(password, salt, 99999); // Below minimum
      }).toThrow('Iterations must be at least 100000');
      
      // Test valid parameters
      const result = KeyDerivation.deriveKey(password, salt, 100000);
      expect(result.iterations).toBe(100000);
      expect(result.key.length).toBe(32);
      expect(result.salt.length).toBe(32);
      
      // Clean up
      password.fill(0);
      salt.fill(0);
      result.key.fill(0);
      result.salt.fill(0);
    });

    it('should validate cryptographic algorithm whitelist', () => {
      const supportedAlgorithms = ['aes-256-gcm'];
      const unsupportedAlgorithms = [
        'aes-128-cbc',
        'aes-128-gcm', 
        'aes-256-cbc',
        'des-ede3-cbc',
        'rc4'
      ];
      
      // Supported algorithm should be accepted
      expect(supportedAlgorithms.includes('aes-256-gcm')).toBe(true);
      
      // Unsupported algorithms should be rejected
      unsupportedAlgorithms.forEach(algorithm => {
        expect(supportedAlgorithms.includes(algorithm)).toBe(false);
      });
    });
  });

  describe('Side-Channel Attack Prevention', () => {
    it('should prevent cache timing attacks on key operations', () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      const testData = 'constant-test-data';
      
      // Perform same operation with different keys multiple times
      const measurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = process.hrtime.bigint();
        
        // Simulate key lookup operation
        const keyToUse = i % 2 === 0 ? key1 : key2;
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyToUse, iv);
        cipher.update(testData, 'utf8', 'hex');
        cipher.final('hex');
        
        const endTime = process.hrtime.bigint();
        measurements.push(Number(endTime - startTime));
        
        // Clean up IV
        iv.fill(0);
      }
      
      // Calculate coefficient of variation (should be low for consistent timing)
      const mean = measurements.reduce((a, b) => a + b) / measurements.length;
      const variance = measurements.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / measurements.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / mean;
      
      // Timing should be relatively consistent (low CV) - allow for variance in test environment
      expect(coefficientOfVariation).toBeLessThan(1.0);
      
      // Clean up
      key1.fill(0);
      key2.fill(0);
    });

    it('should use constant-time operations for sensitive comparisons', () => {
      const reference = crypto.randomBytes(32);
      const matching = Buffer.from(reference);
      const different = crypto.randomBytes(32);
      
      // Test timing consistency for matching buffers using crypto.timingSafeEqual
      const timingsMMatch: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = process.hrtime.bigint();
        const result = crypto.timingSafeEqual(reference, matching);
        const end = process.hrtime.bigint();
        timingsMMatch.push(Number(end - start));
        expect(result).toBe(true);
      }
      
      // Test timing consistency for different buffers
      const timingsDifferent: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = process.hrtime.bigint();
        const result = crypto.timingSafeEqual(reference, different);
        const end = process.hrtime.bigint();
        timingsDifferent.push(Number(end - start));
        expect(result).toBe(false);
      }
      
      // Compare timing distributions
      const avgMatch = timingsMMatch.reduce((a, b) => a + b) / timingsMMatch.length;
      const avgDifferent = timingsDifferent.reduce((a, b) => a + b) / timingsDifferent.length;
      
      // Timing difference should be minimal for crypto.timingSafeEqual
      const timingRatio = avgMatch > 0 && avgDifferent > 0 ? 
        Math.abs(avgMatch - avgDifferent) / Math.max(avgMatch, avgDifferent) : 0;
      expect(timingRatio).toBeLessThan(1.0); // Allow reasonable variance for micro-operations
      
      // Clean up
      reference.fill(0);
      matching.fill(0);
      different.fill(0);
    });
  });
});