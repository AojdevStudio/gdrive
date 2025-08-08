import * as crypto from 'crypto';

export interface DerivedKeyResult {
  key: Buffer;
  salt: Buffer;
  iterations: number;
}

export class KeyDerivation {
  private static readonly MIN_ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 32; // 256 bits for AES-256
  private static readonly SALT_LENGTH = 32;
  private static readonly DIGEST = 'sha256';

  /**
   * Derive a key from a password using PBKDF2
   */
  public static deriveKey(
    password: string | Buffer, 
    salt?: Buffer, 
    iterations: number = KeyDerivation.MIN_ITERATIONS
  ): DerivedKeyResult {
    if (iterations < KeyDerivation.MIN_ITERATIONS) {
      throw new Error(`Iterations must be at least ${KeyDerivation.MIN_ITERATIONS}`);
    }

    const actualSalt = salt ?? KeyDerivation.generateSalt();
    
    const key = crypto.pbkdf2Sync(
      password,
      actualSalt,
      iterations,
      KeyDerivation.KEY_LENGTH,
      KeyDerivation.DIGEST
    );

    return {
      key,
      salt: actualSalt,
      iterations
    };
  }

  /**
   * Generate a cryptographically secure salt
   */
  public static generateSalt(): Buffer {
    return crypto.randomBytes(KeyDerivation.SALT_LENGTH);
  }

  /**
   * Perform timing-safe comparison of versions
   */
  public static timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    
    return crypto.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Clear sensitive data from memory
   */
  public static clearSensitiveData(...buffers: Buffer[]): void {
    for (const buffer of buffers) {
      if (Buffer.isBuffer(buffer)) {
        buffer.fill(0);
      }
    }
  }

  /**
   * Derive key from environment configuration
   */
  public static deriveKeyFromEnvironment(
    envKey: string,
    salt: Buffer,
    iterations: number = KeyDerivation.MIN_ITERATIONS
  ): DerivedKeyResult {
    const keyBase64 = process.env[envKey];
    if (!keyBase64) {
      throw new Error(`Environment variable ${envKey} not found`);
    }

    const keyBuffer = Buffer.from(keyBase64, 'base64');
    const result = KeyDerivation.deriveKey(keyBuffer, salt, iterations);
    
    // Clear the original key buffer
    KeyDerivation.clearSensitiveData(keyBuffer);
    
    return result;
  }
}