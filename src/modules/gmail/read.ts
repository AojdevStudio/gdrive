/**
 * Gmail read operations - getMessage and getThread
 */

import type { gmail_v1 } from 'googleapis';
import type { GmailContext } from '../types.js';
import type {
  GetMessageOptions,
  MessageResult,
  GetThreadOptions,
  ThreadResult,
} from './types.js';

/**
 * Parse headers from a Gmail message
 */
function parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[] | undefined): MessageResult['headers'] {
  const result: MessageResult['headers'] = {};

  if (!headers) {return result;}

  for (const header of headers) {
    const name = header.name?.toLowerCase();
    const value = header.value || '';

    switch (name) {
      case 'from':
        result.from = value;
        break;
      case 'to':
        result.to = value;
        break;
      case 'cc':
        result.cc = value;
        break;
      case 'bcc':
        result.bcc = value;
        break;
      case 'subject':
        result.subject = value;
        break;
      case 'date':
        result.date = value;
        break;
      case 'message-id':
        result.messageId = value;
        break;
      case 'in-reply-to':
        result.inReplyTo = value;
        break;
      case 'references':
        result.references = value;
        break;
    }
  }

  return result;
}

/**
 * Extract body content from message payload
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { plain?: string; html?: string } {
  const body: { plain?: string; html?: string } = {};

  if (!payload) {return body;}

  // Helper to decode base64url content
  const decodeBody = (data: string | undefined | null): string => {
    if (!data) {return '';}
    // Gmail uses URL-safe base64
    return Buffer.from(data, 'base64url').toString('utf-8');
  };

  // Handle simple messages (no parts)
  if (payload.body?.data) {
    const mimeType = payload.mimeType || '';
    if (mimeType === 'text/plain') {
      body.plain = decodeBody(payload.body.data);
    } else if (mimeType === 'text/html') {
      body.html = decodeBody(payload.body.data);
    }
    return body;
  }

  // Handle multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      const mimeType = part.mimeType || '';

      if (mimeType === 'text/plain' && part.body?.data) {
        body.plain = decodeBody(part.body.data);
      } else if (mimeType === 'text/html' && part.body?.data) {
        body.html = decodeBody(part.body.data);
      } else if (mimeType.startsWith('multipart/') && part.parts) {
        // Recursively check nested parts
        const nestedBody = extractBody(part);
        if (nestedBody.plain) {body.plain = nestedBody.plain;}
        if (nestedBody.html) {body.html = nestedBody.html;}
      }
    }
  }

  return body;
}

/**
 * Parse a Gmail message into our result format
 */
function parseMessage(message: gmail_v1.Schema$Message): MessageResult {
  const body = extractBody(message.payload);

  const result: MessageResult = {
    id: message.id!,
    threadId: message.threadId!,
    labelIds: message.labelIds || [],
    snippet: message.snippet || '',
    historyId: message.historyId || '',
    internalDate: message.internalDate || '',
    headers: parseHeaders(message.payload?.headers),
    sizeEstimate: message.sizeEstimate || 0,
  };

  // Only add body if it has content (exactOptionalPropertyTypes compliance)
  if (Object.keys(body).length > 0) {
    result.body = body;
  }

  return result;
}

/**
 * Get a specific message by ID
 *
 * @param options Message ID and format options
 * @param context Gmail API context
 * @returns Full message content
 *
 * @example
 * ```typescript
 * const message = await getMessage({
 *   id: '18c123abc',
 *   format: 'full'
 * }, context);
 *
 * console.log(`Subject: ${message.headers.subject}`);
 * console.log(`Body: ${message.body?.plain || message.body?.html}`);
 * ```
 */
export async function getMessage(
  options: GetMessageOptions,
  context: GmailContext
): Promise<MessageResult> {
  const { id, format = 'full', metadataHeaders } = options;

  // Check cache first
  const cacheKey = `gmail:getMessage:${id}:${format}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('gmail:getMessage', Date.now() - context.startTime);
    return cached as MessageResult;
  }

  // Build params - only include properties with values
  const params: gmail_v1.Params$Resource$Users$Messages$Get = {
    userId: 'me',
    id,
    format,
  };

  if (metadataHeaders && metadataHeaders.length > 0) {
    params.metadataHeaders = metadataHeaders;
  }

  const response = await context.gmail.users.messages.get(params);

  const result = parseMessage(response.data);

  // Cache the result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('gmail:getMessage', Date.now() - context.startTime);
  context.logger.info('Retrieved message', { id, subject: result.headers.subject });

  return result;
}

/**
 * Get a thread with all its messages
 *
 * @param options Thread ID and format options
 * @param context Gmail API context
 * @returns Thread with all messages
 *
 * @example
 * ```typescript
 * const thread = await getThread({
 *   id: '18c123abc',
 *   format: 'full'
 * }, context);
 *
 * console.log(`Thread has ${thread.messages.length} messages`);
 * ```
 */
export async function getThread(
  options: GetThreadOptions,
  context: GmailContext
): Promise<ThreadResult> {
  const { id, format = 'full', metadataHeaders } = options;

  // Check cache first
  const cacheKey = `gmail:getThread:${id}:${format}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('gmail:getThread', Date.now() - context.startTime);
    return cached as ThreadResult;
  }

  // Build params - only include properties with values
  const params: gmail_v1.Params$Resource$Users$Threads$Get = {
    userId: 'me',
    id,
    format,
  };

  if (metadataHeaders && metadataHeaders.length > 0) {
    params.metadataHeaders = metadataHeaders;
  }

  const response = await context.gmail.users.threads.get(params);

  const result: ThreadResult = {
    id: response.data.id!,
    historyId: response.data.historyId || '',
    messages: (response.data.messages || []).map(parseMessage),
  };

  // Cache the result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('gmail:getThread', Date.now() - context.startTime);
  context.logger.info('Retrieved thread', { id, messageCount: result.messages.length });

  return result;
}
