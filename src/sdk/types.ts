/**
 * Core types for the Code Mode SDK layer.
 * Shared between Node (Phase 1) and Workers (Phase 2) implementations.
 */

import type { Logger } from 'winston';
import type { drive_v3, sheets_v4, forms_v1, docs_v1, gmail_v1, calendar_v3 } from 'googleapis';
import type { CacheManagerLike, PerformanceMonitorLike } from '../modules/types.js';
export type { ExecuteResult, Executor } from './executor.js';

/**
 * Full context passed to all SDK runtime operations.
 * Combines googleapis API clients with shared infrastructure.
 */
export interface FullContext {
  logger: Logger;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  startTime: number;
  drive: drive_v3.Drive;
  sheets: sheets_v4.Sheets;
  forms: forms_v1.Forms;
  docs: docs_v1.Docs;
  gmail: gmail_v1.Gmail;
  calendar: calendar_v3.Calendar;
}

/**
 * The full typed SDK object available in execute() sandbox.
 * Each method accepts typed options and returns the operation result.
 */
export interface SDKRuntime {
  drive: {
    search(options: unknown): Promise<unknown>;
    enhancedSearch(options: unknown): Promise<unknown>;
    read(options: unknown): Promise<unknown>;
    createFile(options: unknown): Promise<unknown>;
    createFolder(options: unknown): Promise<unknown>;
    updateFile(options: unknown): Promise<unknown>;
    batchOperations(options: unknown): Promise<unknown>;
  };
  sheets: {
    listSheets(options: unknown): Promise<unknown>;
    readSheet(options: unknown): Promise<unknown>;
    createSheet(options: unknown): Promise<unknown>;
    renameSheet(options: unknown): Promise<unknown>;
    deleteSheet(options: unknown): Promise<unknown>;
    updateCells(options: unknown): Promise<unknown>;
    updateFormula(options: unknown): Promise<unknown>;
    formatCells(options: unknown): Promise<unknown>;
    addConditionalFormat(options: unknown): Promise<unknown>;
    freezeRowsColumns(options: unknown): Promise<unknown>;
    setColumnWidth(options: unknown): Promise<unknown>;
    appendRows(options: unknown): Promise<unknown>;
    readAsRecords(options: unknown): Promise<unknown>;
  };
  forms: {
    createForm(options: unknown): Promise<unknown>;
    readForm(options: unknown): Promise<unknown>;
    addQuestion(options: unknown): Promise<unknown>;
    listResponses(options: unknown): Promise<unknown>;
  };
  docs: {
    createDocument(options: unknown): Promise<unknown>;
    insertText(options: unknown): Promise<unknown>;
    replaceText(options: unknown): Promise<unknown>;
    applyTextStyle(options: unknown): Promise<unknown>;
    insertTable(options: unknown): Promise<unknown>;
  };
  gmail: {
    listMessages(options: unknown): Promise<unknown>;
    listThreads(options: unknown): Promise<unknown>;
    getMessage(options: unknown): Promise<unknown>;
    getThread(options: unknown): Promise<unknown>;
    searchMessages(options: unknown): Promise<unknown>;
    createDraft(options: unknown): Promise<unknown>;
    sendMessage(options: unknown): Promise<unknown>;
    sendDraft(options: unknown): Promise<unknown>;
    listLabels(options: unknown): Promise<unknown>;
    modifyLabels(options: unknown): Promise<unknown>;
    replyToMessage(options: unknown): Promise<unknown>;
    replyAllToMessage(options: unknown): Promise<unknown>;
    forwardMessage(options: unknown): Promise<unknown>;
    listAttachments(options: unknown): Promise<unknown>;
    downloadAttachment(options: unknown): Promise<unknown>;
    sendWithAttachments(options: unknown): Promise<unknown>;
    trashMessage(options: unknown): Promise<unknown>;
    untrashMessage(options: unknown): Promise<unknown>;
    deleteMessage(options: unknown): Promise<unknown>;
    markAsRead(options: unknown): Promise<unknown>;
    markAsUnread(options: unknown): Promise<unknown>;
    archiveMessage(options: unknown): Promise<unknown>;
  };
  calendar: {
    listCalendars(options: unknown): Promise<unknown>;
    getCalendar(options: unknown): Promise<unknown>;
    listEvents(options: unknown): Promise<unknown>;
    getEvent(options: unknown): Promise<unknown>;
    createEvent(options: unknown): Promise<unknown>;
    updateEvent(options: unknown): Promise<unknown>;
    deleteEvent(options: unknown): Promise<unknown>;
    quickAdd(options: unknown): Promise<unknown>;
    checkFreeBusy(options: unknown): Promise<unknown>;
  };
}
