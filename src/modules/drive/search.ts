import type { DriveContext } from '../types.js';

/**
 * Options for searching Google Drive files
 */
export interface SearchOptions {
  /** Search query string (searches file names) */
  query: string;
  /** Maximum number of results to return (default: 10, max: 100) */
  pageSize?: number;
}

/**
 * File metadata returned from search
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
}

/**
 * Result of a search operation
 */
export interface SearchResult {
  query: string;
  totalResults: number;
  files: DriveFile[];
}

/**
 * Search Google Drive for files matching the query
 *
 * @param options Search parameters
 * @param context Drive API context with caching and logging
 * @returns Search results with file metadata
 *
 * @example
 * ```typescript
 * const results = await search({ query: 'reports', pageSize: 20 }, context);
 * console.log(`Found ${results.totalResults} files`);
 * ```
 */
export async function search(
  options: SearchOptions,
  context: DriveContext
): Promise<SearchResult> {
  const { query, pageSize = 10 } = options;

  // Check cache
  const cacheKey = `search:${query}:${pageSize}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('drive:search', Date.now() - context.startTime);
    return cached as SearchResult;
  }

  // Execute search
  const response = await context.drive.files.list({
    q: `name contains '${query}' and trashed = false`,
    pageSize: Math.min(pageSize, 100),
    fields: "files(id, name, mimeType, createdTime, modifiedTime, webViewLink)",
  });

  const result: SearchResult = {
    query,
    totalResults: response.data.files?.length ?? 0,
    files: (response.data.files ?? []) as DriveFile[],
  };

  // Cache result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('drive:search', Date.now() - context.startTime);

  return result;
}

/**
 * Filters for enhanced search
 */
export interface SearchFilters {
  /** MIME type to filter by */
  mimeType?: string;
  /** Only files modified after this date (ISO 8601) */
  modifiedAfter?: string;
  /** Only files modified before this date (ISO 8601) */
  modifiedBefore?: string;
  /** Only files created after this date (ISO 8601) */
  createdAfter?: string;
  /** Only files created before this date (ISO 8601) */
  createdBefore?: string;
  /** Only files shared with me */
  sharedWithMe?: boolean;
  /** Only files owned by me */
  ownedByMe?: boolean;
  /** Only files in specific parent folder */
  parents?: string;
  /** Include trashed files */
  trashed?: boolean;
}

/**
 * Options for enhanced search with filters
 */
export interface EnhancedSearchOptions {
  /** Search query string (optional when using filters) */
  query?: string;
  /** Additional filters to apply */
  filters?: SearchFilters;
  /** Maximum number of results (default: 10, max: 100) */
  pageSize?: number;
  /** Sort order (default: "modifiedTime desc") */
  orderBy?: string;
}

/**
 * Enhanced file metadata with additional fields
 */
export interface EnhancedDriveFile extends DriveFile {
  size?: string;
  parents?: string[];
  iconLink?: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
  permissions?: unknown[];
  description?: string;
  starred?: boolean;
}

/**
 * Result of enhanced search
 */
export interface EnhancedSearchResult {
  query: string;
  totalResults: number;
  files: EnhancedDriveFile[];
}

/**
 * Search Google Drive with advanced filters
 *
 * @param options Enhanced search parameters with filters
 * @param context Drive API context
 * @returns Search results with detailed file metadata
 *
 * @example
 * ```typescript
 * const results = await enhancedSearch({
 *   query: 'budget',
 *   filters: {
 *     mimeType: 'application/vnd.google-apps.spreadsheet',
 *     modifiedAfter: '2025-01-01T00:00:00Z',
 *     ownedByMe: true
 *   },
 *   pageSize: 50,
 *   orderBy: 'modifiedTime desc'
 * }, context);
 * ```
 */
export async function enhancedSearch(
  options: EnhancedSearchOptions,
  context: DriveContext
): Promise<EnhancedSearchResult> {
  const { query, filters, pageSize = 10, orderBy = "modifiedTime desc" } = options;

  // Build query string
  let q = query ? `name contains '${query}'` : "";
  const filterConditions: string[] = [];

  if (filters) {
    if (filters.mimeType) {
      filterConditions.push(`mimeType = '${filters.mimeType}'`);
    }
    if (filters.modifiedAfter) {
      filterConditions.push(`modifiedTime > '${filters.modifiedAfter}'`);
    }
    if (filters.modifiedBefore) {
      filterConditions.push(`modifiedTime < '${filters.modifiedBefore}'`);
    }
    if (filters.createdAfter) {
      filterConditions.push(`createdTime > '${filters.createdAfter}'`);
    }
    if (filters.createdBefore) {
      filterConditions.push(`createdTime < '${filters.createdBefore}'`);
    }
    if (filters.sharedWithMe) {
      filterConditions.push("sharedWithMe = true");
    }
    if (filters.ownedByMe) {
      filterConditions.push("'me' in owners");
    }
    if (filters.parents) {
      filterConditions.push(`'${filters.parents}' in parents`);
    }
    if (!filters.trashed) {
      filterConditions.push("trashed = false");
    }
  } else {
    filterConditions.push("trashed = false");
  }

  // Combine query and filters
  if (filterConditions.length > 0) {
    q = q ? `${q} and ${filterConditions.join(" and ")}` : filterConditions.join(" and ");
  }

  // Check cache
  const cacheKey = `enhancedSearch:${q}:${pageSize}:${orderBy}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('drive:enhancedSearch', Date.now() - context.startTime);
    return cached as EnhancedSearchResult;
  }

  // Execute search
  const response = await context.drive.files.list({
    q: q || 'trashed = false',
    pageSize: Math.min(pageSize, 100),
    fields: "files(id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink, iconLink, owners, permissions, description, starred)",
    orderBy,
  });

  const result: EnhancedSearchResult = {
    query: q,
    totalResults: response.data.files?.length ?? 0,
    files: (response.data.files ?? []) as EnhancedDriveFile[],
  };

  // Cache result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('drive:enhancedSearch', Date.now() - context.startTime);

  return result;
}
