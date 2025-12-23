/**
 * Shared types for all Google Drive MCP modules
 */

import type { drive_v3, sheets_v4, forms_v1, docs_v1, gmail_v1 } from 'googleapis';
import type { Logger } from 'winston';

/**
 * Cache manager interface for storing and retrieving cached data
 */
export interface CacheManagerLike {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

/**
 * Performance monitor interface for tracking operation metrics
 */
export interface PerformanceMonitorLike {
  track(operation: string, duration: number, error?: boolean): void;
}

/**
 * Base context shared by all operations
 */
export interface BaseContext {
  logger: Logger;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  startTime: number;
}

/**
 * Context for Google Drive operations
 */
export interface DriveContext extends BaseContext {
  drive: drive_v3.Drive;
}

/**
 * Context for Google Sheets operations
 */
export interface SheetsContext extends BaseContext {
  sheets: sheets_v4.Sheets;
}

/**
 * Context for Google Forms operations
 */
export interface FormsContext extends BaseContext {
  forms: forms_v1.Forms;
}

/**
 * Context for Google Docs operations
 */
export interface DocsContext extends BaseContext {
  docs: docs_v1.Docs;
}

/**
 * Context for Gmail operations
 */
export interface GmailContext extends BaseContext {
  gmail: gmail_v1.Gmail;
}

/**
 * Standard result format for module operations
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Utility to convert unknown errors to error messages
 */
export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};
