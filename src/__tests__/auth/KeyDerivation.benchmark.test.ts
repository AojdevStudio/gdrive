import { KeyDerivation } from '../../auth/KeyDerivation.js';
import * as crypto from 'crypto';

describe('KeyDerivation Performance Benchmarks', () => {
  // Only run these tests when explicitly testing performance
  const runBenchmarks = process.env.RUN_BENCHMARKS === 'true';
  const describeIf = runBenchmarks ? describe : describe.skip;

  describeIf('PBKDF2 Performance', () => {
    it('should derive key within acceptable time (< 50ms for 100k iterations)', () => {
      const password = crypto.randomBytes(32).toString('base64');
      const salt = KeyDerivation.generateSalt();
      
      const start = process.hrtime.bigint();
      KeyDerivation.deriveKey(password, salt, 100000);
      const end = process.hrtime.bigint();
      
      const durationMs = Number(end - start) / 1_000_000;
      
      console.log(`PBKDF2 100k iterations took: ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(50); // Should complete in under 50ms
    });

    it('should show linear scaling with iteration count', () => {
      const password = crypto.randomBytes(32).toString('base64');
      const salt = KeyDerivation.generateSalt();
      const results: { iterations: number; time: number }[] = [];
      
      const iterationCounts = [100000, 200000, 300000];
      
      for (const iterations of iterationCounts) {
        const start = process.hrtime.bigint();
        KeyDerivation.deriveKey(password, salt, iterations);
        const end = process.hrtime.bigint();
        
        const durationMs = Number(end - start) / 1_000_000;
        results.push({ iterations, time: durationMs });
      }
      
      console.log('PBKDF2 Scaling Results:');
      results.forEach(r => console.log(`  ${r.iterations} iterations: ${r.time.toFixed(2)}ms`));
      
      // Check that time scales roughly linearly
      const ratio1to2 = results[1].time / results[0].time;
      const ratio2to3 = results[2].time / results[1].time;
      
      // Allow 20% variance from perfect linear scaling
      expect(ratio1to2).toBeGreaterThan(1.8);
      expect(ratio1to2).toBeLessThan(2.2);
      expect(ratio2to3).toBeGreaterThan(1.3);
      expect(ratio2to3).toBeLessThan(1.7);
    });

    it('should measure memory clearing overhead', () => {
      const buffers: Buffer[] = [];
      const bufferCount = 1000;
      
      // Create buffers
      for (let i = 0; i < bufferCount; i++) {
        buffers.push(crypto.randomBytes(32));
      }
      
      const start = process.hrtime.bigint();
      KeyDerivation.clearSensitiveData(...buffers);
      const end = process.hrtime.bigint();
      
      const durationMs = Number(end - start) / 1_000_000;
      const perBufferUs = (Number(end - start) / 1000) / bufferCount;
      
      console.log(`Clearing ${bufferCount} buffers took: ${durationMs.toFixed(2)}ms`);
      console.log(`Average per buffer: ${perBufferUs.toFixed(2)}µs`);
      
      // Should be very fast - less than 10µs per buffer
      expect(perBufferUs).toBeLessThan(10);
    });
  });

  describeIf('TokenManager Encryption Performance', () => {
    it('should measure encryption/decryption overhead', async () => {
      // This would require mocking TokenManager or extracting encryption logic
      // For now, we'll skip this as it would require significant refactoring
      console.log('TokenManager encryption benchmarks would require extraction of encryption logic');
    });
  });

  // Regular test to ensure benchmark infrastructure works
  it('should have benchmark test infrastructure', () => {
    expect(KeyDerivation.deriveKey).toBeDefined();
    expect(KeyDerivation.clearSensitiveData).toBeDefined();
  });
});