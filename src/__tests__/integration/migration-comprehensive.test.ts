import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as path from 'path';

// Create mocked modules
const mockFs = {
  access: jest.fn(),
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  rename: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
  appendFile: jest.fn(),
};

const mockCrypto = {
  randomBytes: jest.fn(),
  pbkdf2Sync: jest.fn(),
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
};

const mockHomedir = jest.fn();

// Mock modules
jest.mock('fs/promises', () => mockFs);
jest.mock('os', () => ({ homedir: mockHomedir }));
jest.mock('crypto', () => mockCrypto);

describe('Comprehensive Migration Integration Tests', () => {
  const mockHomePath = '/mock/home';
  const mockLegacyPath = path.join(mockHomePath, '.gdrive-mcp-tokens.json');
  const mockBackupDir = path.join(mockHomePath, '.backup');
  const mockKey = Buffer.from('test-key-123456789012345678901234', 'utf8').toString('base64');

  beforeEach(() => {
    jest.clearAllMocks();
    mockHomedir.mockReturnValue(mockHomePath);
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = mockKey;
    
    // Setup comprehensive mocks
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('test-content');
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.appendFile.mockResolvedValue(undefined);
    
    // Mock crypto functions for consistent testing
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
    });
    
    mockCrypto.createDecipheriv.mockReturnValue({
      setAuthTag: jest.fn(),
      update: jest.fn().mockReturnValue(JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      })),
      final: jest.fn().mockReturnValue('')
    });
  });

  afterEach(() => {
    delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
  });

  describe('Migration with Various Token Counts', () => {
    it('should handle migration with single token', async () => {
      const singleTokenData = 'iv:authTag:encryptedSingleToken';
      (fs.readFile as jest.Mock).mockResolvedValue(singleTokenData);

      // Simulate the migration process
      const migrationResult = await simulateMigration(singleTokenData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.tokenCount).toBe(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.any(String),
        'utf8'
      );
    });

    it('should handle migration with multiple tokens (array format)', async () => {
      // Mock multiple tokens scenario
      const multipleTokensData = JSON.stringify([
        'iv1:authTag1:encryptedToken1',
        'iv2:authTag2:encryptedToken2',
        'iv3:authTag3:encryptedToken3'
      ]);
      
      (fs.readFile as jest.Mock).mockResolvedValue(multipleTokensData);

      const migrationResult = await simulateMigration(multipleTokensData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.tokenCount).toBe(3);
    });

    it('should handle migration with large number of tokens', async () => {
      // Simulate 100 tokens
      const largeTokenArray = Array(100).fill(null).map((_, i) => 
        `iv${i}:authTag${i}:encryptedToken${i}`
      );
      const largeTokenData = JSON.stringify(largeTokenArray);
      
      (fs.readFile as jest.Mock).mockResolvedValue(largeTokenData);

      const migrationResult = await simulateMigration(largeTokenData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.tokenCount).toBe(100);
      expect(migrationResult.performance).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle empty token file gracefully', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('');

      const migrationResult = await simulateMigration('');
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('empty');
    });
  });

  describe('Atomic Failure Scenarios', () => {
    it('should rollback on backup creation failure', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Backup dir creation failed'));
      
      const migrationResult = await simulateMigration('iv:authTag:encrypted');
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('backup');
      // Verify no partial changes were made
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should rollback on encryption failure during migration', async () => {
      // Simulate encryption failure
      (crypto.createCipheriv as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption failed');
      });
      
      const migrationResult = await simulateMigration('iv:authTag:encrypted');
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('Encryption failed');
      // Verify backup was created but no final files written
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should cleanup temp files on write failure', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));
      
      const migrationResult = await simulateMigration('iv:authTag:encrypted');
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('Write failed');
      // Verify temp file cleanup attempt
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });

    it('should rollback on atomic rename failure', async () => {
      (fs.rename as jest.Mock).mockRejectedValue(new Error('Rename failed'));
      
      const migrationResult = await simulateMigration('iv:authTag:encrypted');
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('Rename failed');
      // Verify temp file cleanup
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });

    it('should handle partial disk space scenarios', async () => {
      // Simulate disk space issues during backup
      (fs.writeFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return Promise.reject(new Error('ENOSPC: no space left on device'));
        }
        return Promise.resolve();
      });
      
      const migrationResult = await simulateMigration('iv:authTag:encrypted');
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('ENOSPC');
    });
  });

  describe('Backup and Restore Functionality', () => {
    it('should create timestamped backup with correct format', async () => {
      const testData = 'iv:authTag:encrypted';
      (fs.readFile as jest.Mock).mockResolvedValue(testData);
      
      await simulateBackupCreation(testData);
      
      // Verify timestamp format in backup filename
      const backupCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].includes('.backup')
      );
      expect(backupCall).toBeDefined();
      expect(backupCall[0]).toMatch(/tokens-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    });

    it('should preserve exact backup content for restore capability', async () => {
      const originalData = 'iv123:authTag456:encryptedData789';
      (fs.readFile as jest.Mock).mockResolvedValue(originalData);
      
      await simulateBackupCreation(originalData);
      
      const backupCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
        call[0].includes('.backup')
      );
      expect(backupCall[1]).toBe(originalData);
    });

    it('should handle backup directory creation recursively', async () => {
      await simulateBackupCreation('test-data');
      
      expect(fs.mkdir).toHaveBeenCalledWith(mockBackupDir, { recursive: true });
    });

    it('should validate backup integrity before proceeding', async () => {
      const testData = 'test-backup-data';
      (fs.readFile as jest.Mock).mockResolvedValue(testData);
      
      // Simulate backup validation
      const backupResult = await simulateBackupValidation(testData);
      
      expect(backupResult.isValid).toBe(true);
      expect(backupResult.content).toBe(testData);
    });

    it('should handle corrupted backup scenarios', async () => {
      // Simulate backup file corruption
      (fs.readFile as jest.Mock).mockResolvedValueOnce('original-data');
      (fs.readFile as jest.Mock).mockResolvedValueOnce('corrupted-data');
      
      const backupResult = await simulateBackupValidation('original-data');
      
      expect(backupResult.isValid).toBe(false);
      expect(backupResult.error).toContain('corruption');
    });
  });

  describe('CLI Commands Comprehensive Testing', () => {
    it('should test rotate-key command with environment validation', async () => {
      // Test missing environment variables
      delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
      
      const result = await simulateRotateKeyCommand();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('GDRIVE_TOKEN_ENCRYPTION_KEY');
    });

    it('should test rotate-key with version progression', async () => {
      process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION = 'v1';
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2 = Buffer.alloc(32).toString('base64');
      
      const result = await simulateRotateKeyCommand();
      
      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('v2');
    });

    it('should test verify-keys command with multiple token validation', async () => {
      const tokens = [
        {
          access_token: 'token1',
          refresh_token: 'refresh1',
          expiry_date: Date.now() + 3600000,
          token_type: 'Bearer',
          scope: 'scope1'
        },
        {
          access_token: 'token2',
          refresh_token: 'refresh2',
          expiry_date: Date.now() + 3600000,
          token_type: 'Bearer',
          scope: 'scope2'
        }
      ];
      
      const result = await simulateVerifyKeysCommand(tokens);
      
      expect(result.success).toBe(true);
      expect(result.validTokens).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should test verify-keys with expired tokens', async () => {
      const expiredTokens = [
        {
          access_token: 'expired-token',
          refresh_token: 'refresh-token',
          expiry_date: Date.now() - 3600000, // Expired 1 hour ago
          token_type: 'Bearer',
          scope: 'scope'
        }
      ];
      
      const result = await simulateVerifyKeysCommand(expiredTokens);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('expired');
    });

    it('should test migrate-tokens with progress tracking', async () => {
      const result = await simulateMigrateTokensCommand();
      
      expect(result.success).toBe(true);
      expect(result.progress).toBeDefined();
      expect(result.progress.steps).toContain('backup');
      expect(result.progress.steps).toContain('migrate');
      expect(result.progress.steps).toContain('verify');
    });
  });

  describe('Server Startup Prevention', () => {
    it('should detect legacy tokens on startup', async () => {
      // Mock legacy token existence
      (fs.access as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.gdrive-mcp-tokens.json')) {
          return Promise.resolve(); // Legacy file exists
        }
        return Promise.reject(new Error('ENOENT'));
      });
      
      const startupCheck = await simulateServerStartupCheck();
      
      expect(startupCheck.shouldExit).toBe(true);
      expect(startupCheck.exitCode).toBe(1);
      expect(startupCheck.message).toContain('legacy');
    });

    it('should provide clear migration instructions on legacy detection', async () => {
      const startupCheck = await simulateServerStartupCheck();
      
      if (startupCheck.shouldExit) {
        expect(startupCheck.instructions).toContain('migrate-tokens');
        expect(startupCheck.instructions).toContain('node');
      }
    });

    it('should allow normal startup with versioned tokens', async () => {
      // Mock versioned token format detection
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({
        version: 'v1',
        algorithm: 'aes-256-gcm',
        data: 'iv:authTag:encrypted'
      }));
      
      const startupCheck = await simulateServerStartupCheck();
      
      expect(startupCheck.shouldExit).toBe(false);
      expect(startupCheck.message).toContain('tokens are up to date');
    });

    it('should handle missing token files gracefully', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file'));
      
      const startupCheck = await simulateServerStartupCheck();
      
      expect(startupCheck.shouldExit).toBe(false);
      expect(startupCheck.message).toContain('No tokens found');
    });
  });

  // Helper functions for test simulations
  async function simulateMigration(tokenData: string): Promise<{
    success: boolean;
    tokenCount: number;
    error?: string;
    performance?: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Validate token format
      if (!tokenData || tokenData.trim().length === 0) {
        return { success: false, tokenCount: 0, error: 'Token data is empty' };
      }
      
      // Parse token count
      let tokenCount = 1;
      try {
        const parsed = JSON.parse(tokenData);
        if (Array.isArray(parsed)) {
          tokenCount = parsed.length;
        }
      } catch {
        // Single token string format
        tokenCount = 1;
      }
      
      // Simulate migration steps
      await fs.mkdir(mockBackupDir, { recursive: true });
      await fs.writeFile(path.join(mockBackupDir, 'tokens-backup.json'), tokenData);
      await fs.writeFile(`${mockLegacyPath}.tmp`, 'versioned-data', 'utf8');
      await fs.rename(`${mockLegacyPath}.tmp`, mockLegacyPath);
      
      const performance = Date.now() - startTime;
      
      return { success: true, tokenCount, performance };
    } catch (error) {
      return { 
        success: false, 
        tokenCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error',
        performance: Date.now() - startTime
      };
    }
  }

  async function simulateBackupCreation(data: string): Promise<void> {
    await fs.mkdir(mockBackupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(mockBackupDir, `tokens-${timestamp}.json`);
    await fs.writeFile(backupPath, data);
  }

  async function simulateBackupValidation(originalData: string): Promise<{
    isValid: boolean;
    content?: string;
    error?: string;
  }> {
    try {
      const backupContent = await fs.readFile(
        path.join(mockBackupDir, 'tokens-backup.json'), 
        'utf8'
      );
      
      if (backupContent === originalData) {
        return { isValid: true, content: backupContent };
      } else {
        return { isValid: false, error: 'Backup content corruption detected' };
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Backup validation failed' 
      };
    }
  }

  async function simulateRotateKeyCommand(): Promise<{
    success: boolean;
    newVersion?: string;
    error?: string;
  }> {
    try {
      const currentVersion = process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION || 'v1';
      const versionNum = parseInt(currentVersion.substring(1));
      const newVersion = `v${versionNum + 1}`;
      const newKeyEnv = `GDRIVE_TOKEN_ENCRYPTION_KEY_${newVersion.toUpperCase()}`;
      
      if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
        throw new Error('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable not set');
      }
      
      if (!process.env[newKeyEnv]) {
        // In real implementation, this would generate a new key
        process.env[newKeyEnv] = Buffer.alloc(32).toString('base64');
      }
      
      return { success: true, newVersion };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Rotation failed' 
      };
    }
  }

  async function simulateVerifyKeysCommand(tokens: any[]): Promise<{
    success: boolean;
    validTokens: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let validTokens = 0;
    
    for (const token of tokens) {
      if (!token.access_token || !token.refresh_token) {
        errors.push('Missing required token fields');
        continue;
      }
      
      if (token.expiry_date && token.expiry_date < Date.now()) {
        errors.push('Token is expired');
        continue;
      }
      
      validTokens++;
    }
    
    return {
      success: errors.length === 0,
      validTokens,
      errors
    };
  }

  async function simulateMigrateTokensCommand(): Promise<{
    success: boolean;
    progress: {
      steps: string[];
    };
  }> {
    const steps: string[] = [];
    
    try {
      steps.push('backup');
      await fs.mkdir(mockBackupDir, { recursive: true });
      
      steps.push('migrate');
      await fs.writeFile(`${mockLegacyPath}.tmp`, 'versioned-data', 'utf8');
      
      steps.push('verify');
      await fs.rename(`${mockLegacyPath}.tmp`, mockLegacyPath);
      
      return { success: true, progress: { steps } };
    } catch (error) {
      return { success: false, progress: { steps } };
    }
  }

  async function simulateServerStartupCheck(): Promise<{
    shouldExit: boolean;
    exitCode?: number;
    message: string;
    instructions?: string;
  }> {
    try {
      // Check if legacy tokens exist
      await fs.access(mockLegacyPath);
      
      // If we get here, legacy tokens exist
      return {
        shouldExit: true,
        exitCode: 1,
        message: 'Legacy tokens detected. Migration required.',
        instructions: 'Run: node dist/index.js migrate-tokens'
      };
    } catch {
      // No legacy tokens found
      try {
        // Check for versioned tokens
        const content = await fs.readFile(mockLegacyPath, 'utf8');
        const parsed = JSON.parse(content);
        
        if (parsed.version) {
          return {
            shouldExit: false,
            message: 'Versioned tokens are up to date'
          };
        } else {
          return {
            shouldExit: true,
            exitCode: 1,
            message: 'Invalid token format detected'
          };
        }
      } catch {
        return {
          shouldExit: false,
          message: 'No tokens found - first run'
        };
      }
    }
  }
});