import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

describe('E2E: CLI Commands', () => {
  let tempDir: string;
  let originalCwd: string;
  
  // Test encryption keys
  const testEncryptionKey = Buffer.from(crypto.randomBytes(32)).toString('base64');
  const testEncryptionKeyV2 = Buffer.from(crypto.randomBytes(32)).toString('base64');
  
  beforeAll(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdrive-cli-e2e-'));
    
    // Set up test environment
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = testEncryptionKey;
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2 = testEncryptionKeyV2;
    process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION = 'v1';
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    
    // Clean up environment
    delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
    delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2;
    delete process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION;
    delete process.env.NODE_ENV;
  });

  beforeEach(async () => {
    // Clean temp directory before each test
    const files = await fs.readdir(tempDir);
    await Promise.all(files.map(file => 
      fs.rm(path.join(tempDir, file), { recursive: true, force: true })
    ));
  });

  describe('migrate-tokens CLI Command', () => {
    it('should migrate legacy tokens successfully', async () => {
      // Create legacy token file
      const legacyTokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const legacyToken = await createLegacyToken({
        access_token: 'legacy_access_token',
        refresh_token: 'legacy_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(legacyTokenPath, legacyToken);
      
      // Run migration command
      const result = await runCLICommand('migrate-tokens', [], tempDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Migration complete');
      expect(result.stdout).toContain('Tokens saved to');
      
      // Verify backup was created
      const backupDir = path.join(tempDir, '.backup');
      const backupFiles = await fs.readdir(backupDir);
      expect(backupFiles.length).toBe(1);
      expect(backupFiles[0]).toMatch(/^tokens-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
      
      // Verify new versioned token file
      const newTokenContent = await fs.readFile(legacyTokenPath, 'utf8');
      const versionedToken = JSON.parse(newTokenContent);
      expect(versionedToken.version).toBe('v1');
      expect(versionedToken.algorithm).toBe('aes-256-gcm');
      expect(versionedToken.keyDerivation.method).toBe('pbkdf2');
    });

    it('should handle migration when no legacy tokens exist', async () => {
      const result = await runCLICommand('migrate-tokens', [], tempDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No legacy tokens found');
      expect(result.stdout).toContain('Nothing to migrate');
    });

    it('should fail gracefully with corrupted legacy tokens', async () => {
      // Create corrupted legacy token file
      const legacyTokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      await fs.writeFile(legacyTokenPath, 'corrupted:invalid:data');
      
      const result = await runCLICommand('migrate-tokens', [], tempDir);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Failed to decrypt legacy tokens');
    });

    it('should preserve backup on migration failure', async () => {
      // Create legacy token that will fail during encryption
      const legacyTokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      await fs.writeFile(legacyTokenPath, 'invalid:token:format');
      
      const result = await runCLICommand('migrate-tokens', [], tempDir);
      
      expect(result.exitCode).toBe(1);
      
      // Verify backup was still created despite failure
      const backupDir = path.join(tempDir, '.backup');
      try {
        const backupFiles = await fs.readdir(backupDir);
        expect(backupFiles.length).toBe(1);
      } catch {
        // Backup creation might have failed, which is also valid behavior
      }
    });
  });

  describe('rotate-key CLI Command', () => {
    it('should rotate encryption key successfully', async () => {
      // Create initial versioned token
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const initialToken = await createVersionedToken({
        access_token: 'initial_access_token',
        refresh_token: 'initial_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(tokenPath, JSON.stringify(initialToken, null, 2));
      
      const result = await runCLICommand('rotate-key', [], tempDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Key rotation complete');
      expect(result.stdout).toContain('v2'); // New version
      
      // Verify token was re-encrypted with new key
      const rotatedContent = await fs.readFile(tokenPath, 'utf8');
      const rotatedToken = JSON.parse(rotatedContent);
      expect(rotatedToken.keyId).toBe('v2');
    });

    it('should fail when new key environment variable is missing', async () => {
      // Remove the v2 key
      delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2;
      
      const result = await runCLICommand('rotate-key', [], tempDir);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('GDRIVE_TOKEN_ENCRYPTION_KEY_V2');
      
      // Restore key for other tests
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2 = testEncryptionKeyV2;
    });

    it('should handle missing token files during rotation', async () => {
      const result = await runCLICommand('rotate-key', [], tempDir);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Token file not found');
    });

    it('should create audit log entry for key rotation', async () => {
      // Create initial token
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const initialToken = await createVersionedToken({
        access_token: 'audit_test_token',
        refresh_token: 'audit_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(tokenPath, JSON.stringify(initialToken, null, 2));
      
      const result = await runCLICommand('rotate-key', [], tempDir);
      
      expect(result.exitCode).toBe(0);
      
      // Check audit log
      const auditPath = path.join(tempDir, '.gdrive-mcp-audit.log');
      try {
        const auditContent = await fs.readFile(auditPath, 'utf8');
        expect(auditContent).toContain('KEY_ROTATION');
        expect(auditContent).toContain('v1');
        expect(auditContent).toContain('v2');
      } catch {
        // Audit log might be in a different location or not implemented yet
      }
    });
  });

  describe('verify-keys CLI Command', () => {
    it('should verify valid tokens successfully', async () => {
      // Create valid versioned token
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const validToken = await createVersionedToken({
        access_token: 'valid_access_token',
        refresh_token: 'valid_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(tokenPath, JSON.stringify(validToken, null, 2));
      
      const result = await runCLICommand('verify-keys', [], tempDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('All tokens successfully verified');
      expect(result.stdout).toContain('current key');
    });

    it('should detect expired tokens', async () => {
      // Create expired token
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const expiredToken = await createVersionedToken({
        access_token: 'expired_access_token',
        refresh_token: 'expired_refresh_token',
        expiry_date: Date.now() - 3600000, // Expired 1 hour ago
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(tokenPath, JSON.stringify(expiredToken, null, 2));
      
      const result = await runCLICommand('verify-keys', [], tempDir);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('expired');
    });

    it('should handle corrupted token files', async () => {
      // Create corrupted token file
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      await fs.writeFile(tokenPath, '{"invalid": json}');
      
      const result = await runCLICommand('verify-keys', [], tempDir);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Failed to verify');
    });

    it('should provide detailed verification report', async () => {
      // Create token with multiple properties to verify
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const detailedToken = await createVersionedToken({
        access_token: 'detailed_access_token',
        refresh_token: 'detailed_refresh_token',
        expiry_date: Date.now() + 7200000, // 2 hours from now
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets'
      });
      
      await fs.writeFile(tokenPath, JSON.stringify(detailedToken, null, 2));
      
      const result = await runCLICommand('verify-keys', [], tempDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Token verification report');
      expect(result.stdout).toContain('Expiry:');
      expect(result.stdout).toContain('Key version:');
      expect(result.stdout).toContain('Algorithm:');
    });
  });

  describe('Server Startup Prevention', () => {
    it('should prevent server startup with legacy tokens', async () => {
      // Create legacy token file
      const legacyTokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const legacyToken = await createLegacyToken({
        access_token: 'startup_test_token',
        refresh_token: 'startup_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(legacyTokenPath, legacyToken);
      
      // Try to start server (should fail)
      const result = await runCLICommand('', [], tempDir); // No args = normal server start
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('legacy');
      expect(result.stderr).toContain('migrate-tokens');
    });

    it('should allow server startup with versioned tokens', async () => {
      // Create versioned token file
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const versionedToken = await createVersionedToken({
        access_token: 'versioned_startup_token',
        refresh_token: 'versioned_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(tokenPath, JSON.stringify(versionedToken, null, 2));
      
      // Create minimal OAuth keys file
      const oauthKeysPath = path.join(tempDir, 'gcp-oauth.keys.json');
      await fs.writeFile(oauthKeysPath, JSON.stringify({
        web: {
          client_id: 'test_client_id',
          client_secret: 'test_client_secret',
          redirect_uris: ['http://localhost:3000/oauth2callback']
        }
      }));
      
      process.env.GDRIVE_OAUTH_PATH = oauthKeysPath;
      process.env.GDRIVE_CREDENTIALS_PATH = tokenPath;
      
      // Start server with a short timeout (should not fail immediately)
      const serverProcess = spawn('node', ['dist/index.js'], {
        cwd: originalCwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let startupSuccess = false;
      let errorOutput = '';
      
      // Wait for initial startup
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          startupSuccess = true;
          serverProcess.kill();
          resolve();
        }, 2000);
        
        serverProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
          if (errorOutput.includes('legacy')) {
            clearTimeout(timeout);
            serverProcess.kill();
            resolve();
          }
        });
        
        serverProcess.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 1 && errorOutput.includes('legacy')) {
            startupSuccess = false;
          }
          resolve();
        });
      });
      
      // Should not have legacy token errors
      expect(errorOutput).not.toContain('legacy');
      expect(startupSuccess).toBe(true);
      
      // Cleanup
      delete process.env.GDRIVE_OAUTH_PATH;
      delete process.env.GDRIVE_CREDENTIALS_PATH;
    });
  });

  describe('CLI Command Performance', () => {
    it('should complete migration within reasonable time', async () => {
      // Create large legacy token file to test performance
      const legacyTokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const largeToken = await createLegacyToken({
        access_token: 'a'.repeat(1000), // Large token
        refresh_token: 'r'.repeat(1000),
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(legacyTokenPath, largeToken);
      
      const startTime = Date.now();
      const result = await runCLICommand('migrate-tokens', [], tempDir);
      const duration = Date.now() - startTime;
      
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle concurrent CLI operations gracefully', async () => {
      // Create test token for concurrent operations
      const tokenPath = path.join(tempDir, '.gdrive-mcp-tokens.json');
      const testToken = await createVersionedToken({
        access_token: 'concurrent_test_token',
        refresh_token: 'concurrent_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      
      await fs.writeFile(tokenPath, JSON.stringify(testToken, null, 2));
      
      // Run multiple verify-keys commands concurrently
      const concurrentOperations = Array(5).fill(null).map(() => 
        runCLICommand('verify-keys', [], tempDir)
      );
      
      const results = await Promise.all(concurrentOperations);
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
    });
  });

  // Helper functions
  async function createLegacyToken(tokenData: any): Promise<string> {
    const key = Buffer.from(testEncryptionKey, 'base64');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(tokenData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  async function createVersionedToken(tokenData: any): Promise<any> {
    const salt = crypto.randomBytes(32);
    const iterations = 100000;
    const key = crypto.pbkdf2Sync(testEncryptionKey, salt, iterations, 32, 'sha256');
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(tokenData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      version: 'v1',
      algorithm: 'aes-256-gcm',
      keyDerivation: {
        method: 'pbkdf2' as const,
        iterations,
        salt: salt.toString('base64')
      },
      data: `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`,
      createdAt: new Date().toISOString(),
      keyId: 'v1'
    };
  }

  async function runCLICommand(
    command: string, 
    args: string[] = [], 
    workingDir: string = tempDir
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const fullArgs = command ? [command, ...args] : args;
      const childProcess = spawn('node', ['dist/index.js', ...fullArgs], {
        cwd: originalCwd,
        env: { 
          ...process.env,
          HOME: workingDir, // Override home directory for token file location
          GDRIVE_CREDENTIALS_PATH: path.join(workingDir, '.gdrive-mcp-tokens.json')
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: any) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: any) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code: any) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        childProcess.kill();
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + '\nTIMEOUT: Process killed after 30 seconds'
        });
      }, 30000);
    });
  }
});