declare global {
  var createMockFunction: <T extends (...args: any[]) => any>(implementation?: T) => jest.MockedFunction<T>;
  var mockLogger: () => {
    info: jest.MockedFunction<(message: string, meta?: any) => void>;
    error: jest.MockedFunction<(message: string, meta?: any) => void>;
    warn: jest.MockedFunction<(message: string, meta?: any) => void>;
    debug: jest.MockedFunction<(message: string, meta?: any) => void>;
    verbose: jest.MockedFunction<(message: string, meta?: any) => void>;
    silly: jest.MockedFunction<(message: string, meta?: any) => void>;
    log: jest.MockedFunction<(message: string, meta?: any) => void>;
  };
  var mockCrypto: {
    randomBytes: jest.MockedFunction<(size: number) => Buffer>;
    pbkdf2Sync: jest.MockedFunction<(password: string | Buffer, salt: string | Buffer, iterations: number, keylen: number, digest: string) => Buffer>;
    createCipheriv: jest.MockedFunction<(algorithm: string, key: Buffer, iv: Buffer) => any>;
    createDecipheriv: jest.MockedFunction<(algorithm: string, key: Buffer, iv: Buffer) => any>;
    timingSafeEqual: jest.MockedFunction<(a: Buffer, b: Buffer) => boolean>;
  };
}

export {};