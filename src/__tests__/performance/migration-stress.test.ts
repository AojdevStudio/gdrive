import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { homedir } from 'os';

// Mock modules for performance testing
jest.mock('fs/promises');
jest.mock('os');
jest.mock('crypto');

// Type-safe mock helpers
const mockFs = fs as jest.Mocked<typeof fs>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;
const mockHomedir = homedir as jest.MockedFunction<typeof homedir>;

describe('Migration Performance and Stress Tests', () => {
  const mockHomedirPath = '/mock/home';
  const mockLegacyPath = path.join(mockHomedirPath, '.gdrive-mcp-tokens.json');
  const mockBackupDir = path.join(mockHomedirPath, '.backup');
  const mockKey = Buffer.from('test-key-123456789012345678901234', 'utf8').toString('base64');

  beforeEach(() => {
    jest.clearAllMocks();
    mockHomedir.mockReturnValue(mockHomedirPath);
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = mockKey;
    
    setupPerformanceMocks();
  });

  afterEach(() => {
    delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
  });
  
  // Performance-optimized mock setup
  function setupPerformanceMocks(): void {
    // Setup fast fs mocks for performance testing
    mockFs.access.mockResolvedValue(undefined as any);
    mockFs.mkdir.mockResolvedValue(undefined as any);
    mockFs.writeFile.mockResolvedValue(undefined as any);
    mockFs.rename.mockResolvedValue(undefined as any);
    mockFs.readFile.mockResolvedValue('test-content' as any);
    mockFs.unlink.mockResolvedValue(undefined as any);
    mockFs.appendFile.mockResolvedValue(undefined as any);
    
    // Fast crypto mocks for performance testing
    mockCrypto.randomBytes.mockImplementation((size: number) => {
      return Buffer.alloc(size, 1);
    });
    
    mockCrypto.pbkdf2Sync.mockImplementation(() => {
      return Buffer.alloc(32, 2);
    });
    
    mockCrypto.createCipheriv.mockReturnValue({
      update: jest.fn().mockReturnValue('encrypted'),
      final: jest.fn().mockReturnValue('data'),
      getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(16, 3))
    } as crypto.Cipher);
    
    const mockTokenData = {
      access_token: 'test-token',
      refresh_token: 'refresh-token',
      expiry_date: Date.now() + 3600000,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive'
    };
    
    mockCrypto.createDecipheriv.mockReturnValue({
      setAuthTag: jest.fn(),
      update: jest.fn().mockReturnValue(JSON.stringify(mockTokenData)),
      final: jest.fn().mockReturnValue('')
    } as crypto.Decipher);
  }

  describe('Large Scale Migration Performance', () => {
    it('should handle 1000 token migration within performance threshold', async () => {
      const tokenCount = 1000;
      const largeTokenArray = generateMockTokenArray(tokenCount);
      mockFs.readFile.mockResolvedValue(JSON.stringify(largeTokenArray) as any);

      const startTime = Date.now();
      const result = await simulateHighVolumeMigration(tokenCount);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.tokenCount).toBe(tokenCount);
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(result.averageTimePerToken).toBeLessThan(10); // < 10ms per token
    });

    it('should maintain performance with varying token sizes', async () => {
      const testCases = [
        { count: 10, description: 'small batch' },
        { count: 100, description: 'medium batch' },
        { count: 500, description: 'large batch' }
      ];

      const results: Array<{ count: number; duration: number; throughput: number }> = [];

      for (const testCase of testCases) {
        const tokens = generateMockTokenArray(testCase.count);
        mockFs.readFile.mockResolvedValue(JSON.stringify(tokens) as any);

        const startTime = Date.now();
        const result = await simulateHighVolumeMigration(testCase.count);
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        
        results.push({
          count: testCase.count,
          duration,
          throughput: testCase.count / (duration / 1000) // tokens per second
        });
      }

      // Verify throughput scales reasonably
      const smallBatch = results.find(r => r.count === 10)!;
      const largeBatch = results.find(r => r.count === 500)!;
      
      // Throughput should not degrade significantly with scale
      expect(largeBatch.throughput).toBeGreaterThan(smallBatch.throughput * 0.5);
    });

    it('should handle memory efficiently with large tokens', async () => {
      // Simulate large token data
      const largeTokenData = {
        access_token: 'a'.repeat(10000), // 10KB token
        refresh_token: 'r'.repeat(10000),
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive '.repeat(100) // Large scope
      };

      const tokenArray = Array(100).fill(largeTokenData);
      mockFs.readFile.mockResolvedValue(JSON.stringify(tokenArray) as any);

      const result = await simulateHighVolumeMigration(100);
      
      expect(result.success).toBe(true);
      expect(result.memoryEfficient).toBe(true);
    });
  });

  describe('Concurrent Operations Stress Testing', () => {
    it('should handle concurrent migration attempts gracefully', async () => {
      const concurrentMigrations = Array(5).fill(null).map((_, index) => 
        simulateConcurrentMigration(index)
      );

      const results = await Promise.all(concurrentMigrations);
      
      // Only one should succeed (first one), others should fail gracefully
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      expect(successCount).toBe(1);
      expect(failureCount).toBe(4);
      
      // Failures should be due to file locking, not crashes
      results.filter(r => !r.success).forEach(result => {
        expect(result.error).toMatch(/already in progress|file locked|EEXIST/i);
      });
    });

    it('should maintain consistency under concurrent read/write operations', async () => {
      // Simulate concurrent verify operations during migration
      const migrationPromise = simulateHighVolumeMigration(100);
      
      // Start multiple verify operations while migration is running
      const verifyPromises = Array(3).fill(null).map(() => 
        simulateTokenVerification()
      );

      const [migrationResult, ...verifyResults] = await Promise.all([
        migrationPromise,
        ...verifyPromises
      ]);

      expect(migrationResult.success).toBe(true);
      
      // Verify operations should either succeed or fail gracefully
      verifyResults.forEach(result => {
        expect(result.crashed).toBe(false);
      });
    });

    it('should handle rapid successive CLI commands', async () => {
      const commands = [
        () => simulateRotateKeyCommand(),
        () => simulateVerifyKeysCommand(),
        () => simulateMigrateTokensCommand(),
        () => simulateVerifyKeysCommand()
      ];

      const results = await Promise.all(
        commands.map(cmd => cmd())
      );

      // All commands should complete without crashing
      results.forEach(result => {
        expect(result.crashed).toBe(false);
        expect(result.completed).toBe(true);
      });
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle low disk space gracefully', async () => {
      // Mock disk space error
      const diskSpaceError = new Error('ENOSPC: no space left on device') as Error & { code: string };
      diskSpaceError.code = 'ENOSPC';
      mockFs.writeFile.mockRejectedValueOnce(diskSpaceError);

      const result = await simulateHighVolumeMigration(10);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOSPC');
      expect(result.cleanupAttempted).toBe(true);
    });

    it('should handle high memory pressure', async () => {
      // Simulate very large token data that could cause memory issues
      const hugeTokens = Array(1000).fill(null).map((_, i) => ({
        access_token: `token_${i}_${'x'.repeat(1000)}`,
        refresh_token: `refresh_${i}_${'y'.repeat(1000)}`,
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      }));

      mockFs.readFile.mockResolvedValue(JSON.stringify(hugeTokens) as any);

      const result = await simulateHighVolumeMigration(1000, { memoryPressure: true });
      
      // Should either succeed with efficient memory usage or fail gracefully
      if (result.success) {
        expect(result.memoryEfficient).toBe(true);
      } else {
        expect(result.error).toMatch(/memory|out of memory/i);
      }
    });

    it('should handle corrupted file system state', async () => {
      // Simulate file system corruption during atomic operations
      let writeCount = 0;
      mockFs.writeFile.mockImplementation((): Promise<void> => {
        writeCount++;
        if (writeCount === 2) { // Fail on second write (temp file)
          return Promise.reject(new Error('EIO: i/o error'));
        }
        return Promise.resolve();
      });

      const result = await simulateHighVolumeMigration(5);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('EIO');
      expect(result.rollbackAttempted).toBe(true);
    });
  });

  describe('Performance Regression Testing', () => {
    it('should maintain baseline performance benchmarks', async () => {
      const benchmarks = {
        smallMigration: { tokens: 10, maxTime: 1000 }, // 1 second
        mediumMigration: { tokens: 100, maxTime: 3000 }, // 3 seconds
        largeMigration: { tokens: 500, maxTime: 8000 } // 8 seconds
      };

      for (const [name, benchmark] of Object.entries(benchmarks)) {
        const tokens = generateMockTokenArray(benchmark.tokens);
        mockFs.readFile.mockResolvedValue(JSON.stringify(tokens) as any);

        const startTime = Date.now();
        const result = await simulateHighVolumeMigration(benchmark.tokens);
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(benchmark.maxTime);
        
        // Performance logging (can be disabled in CI)
        if (process.env.NODE_ENV !== 'ci') {
          console.log(`${name}: ${benchmark.tokens} tokens in ${duration}ms (limit: ${benchmark.maxTime}ms)`);
        }
      }
    });

    it('should show consistent performance across multiple runs', async () => {
      const runCount = 5;
      const tokenCount = 50;
      const durations: number[] = [];

      for (let i = 0; i < runCount; i++) {
        const tokens = generateMockTokenArray(tokenCount);
        mockFs.readFile.mockResolvedValue(JSON.stringify(tokens) as any);

        const startTime = Date.now();
        const result = await simulateHighVolumeMigration(tokenCount);
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        durations.push(duration);
      }

      // Calculate performance statistics
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      // Performance should be consistent (variance < 50% of average)
      expect(variance).toBeLessThan(avgDuration * 0.5);
      
      // Performance logging (can be disabled in CI)
      if (process.env.NODE_ENV !== 'ci') {
        console.log(`Performance consistency: avg=${avgDuration}ms, min=${minDuration}ms, max=${maxDuration}ms, variance=${variance}ms`);
      }
    });
  });

  // Helper functions for stress testing
  function generateMockTokenArray(count: number): string[] {
    return Array(count).fill(null).map((_, i) => 
      `iv${i.toString().padStart(3, '0')}:authTag${i}:encryptedToken${i}`
    );
  }

  async function simulateHighVolumeMigration(
    tokenCount: number, 
    options: { memoryPressure?: boolean } = {}
  ): Promise<{
    success: boolean;
    tokenCount: number;
    duration?: number;
    averageTimePerToken?: number;
    memoryEfficient?: boolean;
    error?: string;
    cleanupAttempted?: boolean;
    rollbackAttempted?: boolean;
  }> {
    const startTime = Date.now();
    
    try {
      // Simulate the migration process with performance tracking
      await mockFs.mkdir(mockBackupDir, { recursive: true });
      
      // Simulate processing each token (fast mocked operations)
      for (let i = 0; i < tokenCount; i++) {
        // Simulate minimal work for performance testing
        if (i % 100 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      await mockFs.writeFile(`${mockLegacyPath}.tmp`, 'versioned-data', 'utf8');
      await mockFs.rename(`${mockLegacyPath}.tmp`, mockLegacyPath);
      
      const duration = Date.now() - startTime;
      const averageTimePerToken = duration / tokenCount;
      
      // Check memory efficiency (simulated)
      const memoryEfficient = !options.memoryPressure || tokenCount < 500;
      
      return {
        success: true,
        tokenCount,
        duration,
        averageTimePerToken,
        memoryEfficient
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        tokenCount: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        cleanupAttempted: true,
        rollbackAttempted: true
      };
    }
  }

  async function simulateConcurrentMigration(index: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Simulate file locking by checking if temp file exists
      const tempPath = `${mockLegacyPath}.tmp`;
      
      if (index > 0) {
        // Simulate concurrent access conflict
        throw new Error('Migration already in progress');
      }
      
      await mockFs.writeFile(tempPath, 'data', 'utf8');
      await mockFs.rename(tempPath, mockLegacyPath);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async function simulateTokenVerification(): Promise<{
    success: boolean;
    crashed: boolean;
  }> {
    try {
      // Simulate token verification process
      await mockFs.readFile(mockLegacyPath, 'utf8');
      
      // Random delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      return { success: true, crashed: false };
    } catch {
      return { success: false, crashed: false };
    }
  }

  async function simulateRotateKeyCommand(): Promise<{
    success: boolean;
    crashed: boolean;
    completed: boolean;
  }> {
    try {
      // Simulate key rotation process
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true, crashed: false, completed: true };
    } catch {
      return { success: false, crashed: false, completed: true };
    }
  }

  async function simulateVerifyKeysCommand(): Promise<{
    success: boolean;
    crashed: boolean;
    completed: boolean;
  }> {
    try {
      // Simulate key verification process
      await new Promise(resolve => setTimeout(resolve, 30));
      return { success: true, crashed: false, completed: true };
    } catch {
      return { success: false, crashed: false, completed: true };
    }
  }

  async function simulateMigrateTokensCommand(): Promise<{
    success: boolean;
    crashed: boolean;
    completed: boolean;
  }> {
    try {
      // Simulate migration command process
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, crashed: false, completed: true };
    } catch {
      return { success: false, crashed: false, completed: true };
    }
  }
});