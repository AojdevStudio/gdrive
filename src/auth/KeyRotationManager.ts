import { Logger } from 'winston';

export interface KeyMetadata {
  version: string;
  algorithm: string;
  createdAt: string;
  iterations: number;
  salt: string;
}

export interface RegisteredKey {
  version: string;
  key: Buffer;
  metadata: KeyMetadata;
}

export class KeyRotationManager {
  private static _instance: KeyRotationManager;
  private readonly logger: Logger;
  private readonly registeredKeys: Map<string, RegisteredKey>;
  private currentVersion: string;

  private constructor(logger: Logger) {
    this.logger = logger;
    this.registeredKeys = new Map();
    this.currentVersion = 'v1';
    
    this.logger.debug('KeyRotationManager initialized');
  }

  public static getInstance(logger: Logger): KeyRotationManager {
    if (!KeyRotationManager._instance) {
      KeyRotationManager._instance = new KeyRotationManager(logger);
    }
    return KeyRotationManager._instance;
  }

  /**
   * Register a new key version
   */
  public registerKey(version: string, key: Buffer, metadata: KeyMetadata): void {
    // Validate version format
    if (!version || typeof version !== 'string' || !version.match(/^v\d+$/)) {
      throw new Error('Version must be in format "v1", "v2", etc.');
    }

    if (this.registeredKeys.has(version)) {
      throw new Error(`Key version ${version} already registered`);
    }

    // Validate key
    if (!Buffer.isBuffer(key)) {
      throw new Error('Key must be a Buffer');
    }

    if (key.length !== 32) {
      throw new Error('Key must be 32 bytes for AES-256');
    }

    // Validate metadata
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Invalid metadata object');
    }

    if (metadata.version !== version) {
      throw new Error('Metadata version must match registration version');
    }

    if (!metadata.algorithm || metadata.algorithm !== 'aes-256-gcm') {
      throw new Error('Only aes-256-gcm algorithm is supported');
    }

    if (!metadata.iterations || metadata.iterations < 100000) {
      throw new Error('Iterations must be at least 100000');
    }

    this.registeredKeys.set(version, {
      version,
      key,
      metadata
    });

    this.logger.info('Registered new key version', { version });
  }

  /**
   * Get a specific key version
   */
  public getKey(version: string): RegisteredKey | undefined {
    return this.registeredKeys.get(version);
  }

  /**
   * Get the current key version
   */
  public getCurrentKey(): RegisteredKey {
    const key = this.registeredKeys.get(this.currentVersion);
    if (!key) {
      throw new Error(`Current key version ${this.currentVersion} not found`);
    }
    return key;
  }

  /**
   * Set the current key version
   */
  public setCurrentVersion(version: string): void {
    if (!this.registeredKeys.has(version)) {
      throw new Error(`Key version ${version} not registered`);
    }
    this.currentVersion = version;
    this.logger.info('Updated current key version', { version });
  }

  /**
   * Get all registered key versions
   */
  public getVersions(): string[] {
    return Array.from(this.registeredKeys.keys());
  }

  /**
   * Get key metadata for a version
   */
  public getKeyMetadata(version: string): KeyMetadata | undefined {
    const key = this.registeredKeys.get(version);
    return key?.metadata;
  }

  /**
   * Check if a version exists
   */
  public hasVersion(version: string): boolean {
    return this.registeredKeys.has(version);
  }

  /**
   * Clear all keys from memory
   */
  public clearKeys(): void {
    for (const registeredKey of this.registeredKeys.values()) {
      registeredKey.key.fill(0);
    }
    this.registeredKeys.clear();
    this.logger.info('Cleared all keys from memory');
  }
}