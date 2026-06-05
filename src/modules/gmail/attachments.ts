/**
 * Gmail attachment operations - listAttachments, downloadAttachment, readAttachmentText, sendWithAttachments
 */

import { DOMParser } from '@xmldom/xmldom';
import type { gmail_v1 } from 'googleapis';
import JSZip from 'jszip';
import type { GmailContext } from '../types.js';
import type {
  ListAttachmentsOptions,
  ListAttachmentsResult,
  AttachmentInfo,
  DownloadAttachmentOptions,
  DownloadAttachmentResult,
  ReadAttachmentTextOptions,
  ReadAttachmentTextResult,
  SendWithAttachmentsOptions,
  SendWithAttachmentsResult,
} from './types.js';
import { buildMultipartMessage, encodeToBase64Url, validateAndSanitizeRecipients } from './utils.js';

const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_TEXT_CHARACTERS = 200_000;
const DEFAULT_PDF_MAX_PAGES = 50;
const DEFAULT_DOCX_MAX_XML_BYTES = 2 * 1024 * 1024;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*={0,2}$/;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP64_SIZE_SENTINEL = 0xffffffff;

const TEXT_LIKE_MIME_TYPES = new Set([
  'application/csv',
  'application/json',
  'application/ld+json',
  'application/markdown',
  'application/rtf',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'application/xhtml+xml',
  'text/csv',
  'text/markdown',
  'text/tab-separated-values',
]);

const TEXT_LIKE_EXTENSIONS = new Set([
  '.csv',
  '.htm',
  '.html',
  '.json',
  '.log',
  '.md',
  '.markdown',
  '.rtf',
  '.text',
  '.tsv',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

interface CollectedAttachment extends AttachmentInfo {
  gmailAttachmentId: string;
  partPath: string;
}

class AttachmentSizeError extends Error {
  constructor(readonly size: number, readonly maxBytes: number) {
    super(`Attachment exceeds maxBytes (${size} > ${maxBytes})`);
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) {return fallback;}
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Attachment limits must be positive integers');
  }
  return value;
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() || 'application/octet-stream';
}

function getLowercaseExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
}

function isTextLikeAttachment(filename: string, mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  if (normalized.startsWith('text/')) {return true;}
  if (TEXT_LIKE_MIME_TYPES.has(normalized)) {return true;}
  return TEXT_LIKE_EXTENSIONS.has(getLowercaseExtension(filename));
}

function isPdfAttachment(filename: string, mimeType: string): boolean {
  return normalizeMimeType(mimeType) === 'application/pdf' || getLowercaseExtension(filename) === '.pdf';
}

function isDocxAttachment(filename: string, mimeType: string): boolean {
  return normalizeMimeType(mimeType) === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    getLowercaseExtension(filename) === '.docx';
}

function unsupportedReason(filename: string, mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  const extension = getLowercaseExtension(filename);
  if (extension === '.doc' || normalized === 'application/msword') {
    return 'Legacy .doc parsing is not implemented in this attachment reading slice.';
  }
  if (normalized.startsWith('image/')) {
    return 'Image OCR is not implemented in this attachment reading slice.';
  }
  if (
    extension === '.docm' ||
    extension === '.ppt' ||
    extension === '.pptx' ||
    extension === '.xls' ||
    extension === '.xlsx' ||
    normalized.includes('vnd.ms-') ||
    normalized.includes('vnd.openxmlformats-officedocument')
  ) {
    return 'Only Word .docx Office parsing is implemented in this attachment reading slice.';
  }
  return 'Unsupported binary attachment type. Use downloadAttachment for raw base64url content.';
}

function buildStableAttachmentId(partPath: string, filename: string, mimeType: string, size: number): string {
  return `part_${Buffer.from(JSON.stringify({
    v: 1,
    path: partPath,
    filename,
    mimeType,
    size,
  })).toString('base64url')}`;
}

function decodeBase64UrlData(data: string): Buffer {
  if (!BASE64URL_PATTERN.test(data) || data.length % 4 === 1) {
    throw new Error('Attachment data is not valid base64url');
  }
  return Buffer.from(data, 'base64url');
}

function multiplyMatrices(left: SimpleDOMMatrix, right: SimpleDOMMatrix): [number, number, number, number, number, number] {
  return [
    left.a * right.a + left.c * right.b,
    left.b * right.a + left.d * right.b,
    left.a * right.c + left.c * right.d,
    left.b * right.c + left.d * right.d,
    left.a * right.e + left.c * right.f + left.e,
    left.b * right.e + left.d * right.f + left.f,
  ];
}

class SimpleDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[] | SimpleDOMMatrix) {
    if (!init) {return;}
    const values = Array.isArray(init) ? init : [init.a, init.b, init.c, init.d, init.e, init.f];
    [this.a = 1, this.b = 0, this.c = 0, this.d = 1, this.e = 0, this.f = 0] = values;
  }

  multiplySelf(other: SimpleDOMMatrix): this {
    [this.a, this.b, this.c, this.d, this.e, this.f] = multiplyMatrices(this, other);
    return this;
  }

  preMultiplySelf(other: SimpleDOMMatrix): this {
    [this.a, this.b, this.c, this.d, this.e, this.f] = multiplyMatrices(other, this);
    return this;
  }

  translate(x = 0, y = 0): SimpleDOMMatrix {
    return new SimpleDOMMatrix(this).translateSelf(x, y);
  }

  translateSelf(x = 0, y = 0): this {
    return this.multiplySelf(new SimpleDOMMatrix([1, 0, 0, 1, x, y]));
  }

  scale(scaleX = 1, scaleY = scaleX): SimpleDOMMatrix {
    return new SimpleDOMMatrix(this).scaleSelf(scaleX, scaleY);
  }

  scaleSelf(scaleX = 1, scaleY = scaleX): this {
    return this.multiplySelf(new SimpleDOMMatrix([scaleX, 0, 0, scaleY, 0, 0]));
  }

  invertSelf(): this {
    const determinant = this.a * this.d - this.b * this.c;
    if (determinant === 0) {
      throw new Error('Cannot invert DOMMatrix with zero determinant');
    }
    [this.a, this.b, this.c, this.d, this.e, this.f] = [
      this.d / determinant,
      -this.b / determinant,
      -this.c / determinant,
      this.a / determinant,
      (this.c * this.f - this.d * this.e) / determinant,
      (this.b * this.e - this.a * this.f) / determinant,
    ];
    return this;
  }
}

function ensurePdfDomMatrix(): void {
  if (!('DOMMatrix' in globalThis)) {
    (globalThis as Record<string, unknown>).DOMMatrix = SimpleDOMMatrix;
  }
}

function limitDecodedText(text: string, maxCharacters: number): { text: string; truncated: boolean } {
  if (text.length <= maxCharacters) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxCharacters), truncated: true };
}

function buildReadLimits(options: ReadAttachmentTextOptions): ReadAttachmentTextResult['limits'] {
  return {
    maxBytes: normalizePositiveInteger(options.maxBytes, DEFAULT_MAX_ATTACHMENT_BYTES),
    maxCharacters: normalizePositiveInteger(options.maxCharacters, DEFAULT_MAX_TEXT_CHARACTERS),
    pdfMaxPages: normalizePositiveInteger(options.pdfMaxPages, DEFAULT_PDF_MAX_PAGES),
    docxMaxXmlBytes: normalizePositiveInteger(options.docxMaxXmlBytes, DEFAULT_DOCX_MAX_XML_BYTES),
  };
}

/**
 * Recursively extract attachment metadata from a message part tree
 */
function extractAttachments(
  parts: gmail_v1.Schema$MessagePart[] | undefined,
  result: CollectedAttachment[],
  parentPath = 'parts'
): void {
  if (!parts) {return;}

  parts.forEach((part, index) => {
    const partPath = `${parentPath}.${index}`;
    // A part is an attachment if it has an attachmentId and a filename
    if (part.body?.attachmentId && part.filename && part.filename.length > 0) {
      const size = part.body.size || 0;
      const mimeType = part.mimeType || 'application/octet-stream';
      result.push({
        attachmentId: buildStableAttachmentId(partPath, part.filename, mimeType, size),
        gmailAttachmentId: part.body.attachmentId,
        partPath,
        filename: part.filename,
        mimeType,
        size,
      });
    }

    // Recurse into nested parts
    if (part.parts) {
      extractAttachments(part.parts, result, `${partPath}.parts`);
    }
  });
}

function collectAttachments(payload: gmail_v1.Schema$MessagePart | undefined): CollectedAttachment[] {
  const attachments: CollectedAttachment[] = [];
  if (!payload) {return attachments;}

  if (payload.body?.attachmentId && payload.filename && payload.filename.length > 0) {
    const size = payload.body.size || 0;
    const mimeType = payload.mimeType || 'application/octet-stream';
    attachments.push({
      attachmentId: buildStableAttachmentId('root', payload.filename, mimeType, size),
      gmailAttachmentId: payload.body.attachmentId,
      partPath: 'root',
      filename: payload.filename,
      mimeType,
      size,
    });
  }

  extractAttachments(payload.parts, attachments);
  return attachments;
}

function toPublicAttachment(attachment: CollectedAttachment): AttachmentInfo {
  return {
    attachmentId: attachment.attachmentId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
  };
}

/**
 * List all attachments for a given message.
 *
 * Returns attachment metadata (filename, mimeType, size, attachmentId).
 * Use downloadAttachment() to retrieve the actual file content.
 *
 * @param options Message ID to list attachments for
 * @param context Gmail API context
 * @returns List of attachment metadata
 *
 * @example
 * ```typescript
 * const result = await listAttachments({ messageId: '18c123abc' }, context);
 *
 * result.attachments.forEach(att => {
 *   console.log(`${att.filename} (${att.size} bytes)`);
 * });
 * ```
 */
export async function listAttachments(
  options: ListAttachmentsOptions,
  context: GmailContext
): Promise<ListAttachmentsResult> {
  const { messageId } = options;

  const response = await context.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const payload = response.data.payload;
  const attachments = collectAttachments(payload);

  context.performanceMonitor.track('gmail:listAttachments', Date.now() - context.startTime);
  context.logger.info('Listed attachments', {
    messageId,
    count: attachments.length,
  });

  return {
    messageId,
    attachments: attachments.map(toPublicAttachment),
  };
}

/**
 * Download a specific attachment from a message.
 *
 * Returns the attachment content as base64-encoded data along with metadata.
 *
 * @param options Message ID and attachment ID to download
 * @param context Gmail API context
 * @returns Attachment data and metadata
 *
 * @example
 * ```typescript
 * const att = await downloadAttachment({
 *   messageId: '18c123abc',
 *   attachmentId: 'ANGjdJ...',
 * }, context);
 *
 * // Write to file: Buffer.from(att.data, 'base64').toString()
 * console.log(`Downloaded: ${att.filename} (${att.size} bytes)`);
 * ```
 */
export async function downloadAttachment(
  options: DownloadAttachmentOptions,
  context: GmailContext
): Promise<DownloadAttachmentResult> {
  const {
    messageId,
    attachmentId,
    maxBytes = DEFAULT_MAX_ATTACHMENT_BYTES,
  } = options;
  const effectiveMaxBytes = normalizePositiveInteger(maxBytes, DEFAULT_MAX_ATTACHMENT_BYTES);

  // First get the message to find the attachment metadata (filename, mimeType)
  let messageData: gmail_v1.Schema$Message;
  try {
    const messageResponse = await context.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    messageData = messageResponse.data;
  } catch {
    throw new Error('Gmail API failed while reading attachment metadata');
  }

  // Find the attachment part to get its metadata
  const allAttachments = collectAttachments(messageData.payload);
  const attachmentMeta = allAttachments.find(a =>
    a.attachmentId === attachmentId || a.gmailAttachmentId === attachmentId
  );

  if (!attachmentMeta) {
    throw new Error('Attachment metadata not found for requested attachmentId');
  }

  if (attachmentMeta.size > effectiveMaxBytes) {
    throw new AttachmentSizeError(attachmentMeta.size, effectiveMaxBytes);
  }

  // Download the attachment content
  let attachmentBody: gmail_v1.Schema$MessagePartBody;
  try {
    const response = await context.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentMeta.gmailAttachmentId,
    });
    attachmentBody = response.data;
  } catch {
    throw new Error('Gmail API failed while downloading attachment');
  }

  const reportedSize = attachmentBody.size || attachmentMeta.size || 0;
  const data = attachmentBody.data ?? '';
  if (reportedSize > effectiveMaxBytes) {
    throw new AttachmentSizeError(reportedSize, effectiveMaxBytes);
  }
  if (!data && reportedSize > 0) {
    throw new Error('Gmail API returned attachment content without data for requested attachmentId');
  }
  const decodedSize = data ? decodeBase64UrlData(data).byteLength : 0;
  const size = Math.max(reportedSize, decodedSize);

  if (size > effectiveMaxBytes) {
    throw new AttachmentSizeError(size, effectiveMaxBytes);
  }

  context.performanceMonitor.track('gmail:downloadAttachment', Date.now() - context.startTime);
  context.logger.info('Downloaded attachment', {
    messageId,
    attachmentId,
    size,
  });

  return {
    messageId,
    attachmentId,
    filename: attachmentMeta.filename,
    mimeType: attachmentMeta.mimeType,
    size,
    data,
    dataEncoding: 'base64url',
    maxBytes: effectiveMaxBytes,
  };
}

async function extractPdfText(buffer: Buffer, maxPages: number): Promise<string> {
  ensurePdfDomMatrix();
  const [pdfjs, pdfWorker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ]);

  const pdfjsGlobal = globalThis as typeof globalThis & {
    pdfjsWorker?: typeof pdfWorker;
  };
  if (!pdfjsGlobal.pdfjsWorker) {
    pdfjsGlobal.pdfjsWorker = pdfWorker;
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
  });
  let document: Awaited<typeof loadingTask.promise> | undefined;

  try {
    document = await loadingTask.promise;
    const pagesToRead = Math.min(document.numPages, maxPages);
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      if (text) {
        pageTexts.push(text);
      }
    }

    return pageTexts.join('\n\n').trim();
  } finally {
    if (document) {
      await document.cleanup().catch(() => undefined);
    }
    await loadingTask.destroy().catch(() => undefined);
  }
}

function findZipEndOfCentralDirectory(buffer: Buffer): number {
  const minimumEocdBytes = 22;
  const maxCommentBytes = 0xffff;
  const minOffset = Math.max(0, buffer.length - minimumEocdBytes - maxCommentBytes);

  for (let offset = buffer.length - minimumEocdBytes; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error('DOCX ZIP central directory was not found');
}

function getZipEntryUncompressedSize(buffer: Buffer, entryName: string): number | undefined {
  const eocdOffset = findZipEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
    throw new Error('Multi-disk DOCX ZIP files are not supported');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (
    entryCount === 0xffff ||
    centralDirectorySize === ZIP64_SIZE_SENTINEL ||
    centralDirectoryOffset === ZIP64_SIZE_SENTINEL
  ) {
    throw new Error('DOCX ZIP64 central directory metadata is not supported for safe extraction');
  }

  let offset = centralDirectoryOffset;
  let matchingSize: number | undefined;
  let processedEntries = 0;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > buffer.length) {
    throw new Error('DOCX ZIP central directory is truncated');
  }

  while (offset < centralDirectoryEnd) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('DOCX ZIP central directory entry is invalid');
    }
    processedEntries += 1;

    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const filenameStart = offset + 46;
    const nextOffset = filenameStart + filenameLength + extraLength + commentLength;
    if (nextOffset > buffer.length) {
      throw new Error('DOCX ZIP central directory entry is truncated');
    }

    const filename = buffer.toString('utf8', filenameStart, filenameStart + filenameLength);
    if (filename === entryName) {
      if (matchingSize !== undefined) {
        throw new Error('DOCX document.xml has duplicate ZIP entries');
      }
      if (uncompressedSize === ZIP64_SIZE_SENTINEL) {
        throw new Error('DOCX document.xml ZIP64 size metadata is not supported for safe extraction');
      }
      matchingSize = uncompressedSize;
    }

    offset = nextOffset;
  }

  if (processedEntries !== entryCount) {
    throw new Error('DOCX ZIP central directory entry count mismatch');
  }

  return matchingSize;
}

async function extractDocxText(buffer: Buffer, maxXmlBytes: number): Promise<string> {
  const documentXmlSize = getZipEntryUncompressedSize(buffer, 'word/document.xml');
  if (documentXmlSize === undefined) {
    throw new Error('DOCX document.xml was not found');
  }
  if (documentXmlSize > maxXmlBytes) {
    throw new Error(`DOCX document.xml exceeds docxMaxXmlBytes (${maxXmlBytes})`);
  }

  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('DOCX document.xml was not found');
  }

  const documentXmlBuffer = await documentXmlFile.async('nodebuffer');
  if (documentXmlBuffer.byteLength > maxXmlBytes) {
    throw new Error(`DOCX document.xml exceeds docxMaxXmlBytes (${maxXmlBytes})`);
  }
  const documentXml = documentXmlBuffer.toString('utf8');

  const parsed = new DOMParser().parseFromString(documentXml, 'application/xml');
  const paragraphs = parsed.getElementsByTagName('w:p');
  const paragraphTexts: string[] = [];

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs.item(paragraphIndex);
    if (!paragraph) {continue;}
    const textNodes = paragraph.getElementsByTagName('w:t');
    const pieces: string[] = [];
    for (let textIndex = 0; textIndex < textNodes.length; textIndex += 1) {
      const textNode = textNodes.item(textIndex);
      if (textNode?.textContent) {
        pieces.push(textNode.textContent);
      }
    }
    const paragraphText = pieces.join('');
    if (paragraphText) {
      paragraphTexts.push(paragraphText);
    }
  }

  return paragraphTexts.join('\n').trim();
}

/**
 * Read an attachment as decoded text when the attachment format is supported.
 *
 * Supported formats are text-like content, PDFs with extractable text, and Word
 * .docx files. OCR, scanned PDFs, legacy .doc, non-docx Office files, and
 * unknown binary parsing are intentionally out of scope.
 */
export async function readAttachmentText(
  options: ReadAttachmentTextOptions,
  context: GmailContext
): Promise<ReadAttachmentTextResult> {
  const limits = buildReadLimits(options);
  let raw: DownloadAttachmentResult;

  try {
    raw = await downloadAttachment(
      {
        messageId: options.messageId,
        attachmentId: options.attachmentId,
        maxBytes: limits.maxBytes,
      },
      context
    );
  } catch (error) {
    if (error instanceof AttachmentSizeError) {
      return {
        messageId: options.messageId,
        attachmentId: options.attachmentId,
        filename: '',
        mimeType: 'application/octet-stream',
        size: error.size,
        status: 'oversize',
        truncated: false,
        reason: error.message,
        limits,
      };
    }
    if (error instanceof Error && error.message === 'Attachment data is not valid base64url') {
      return {
        messageId: options.messageId,
        attachmentId: options.attachmentId,
        filename: '',
        mimeType: 'application/octet-stream',
        size: 0,
        status: 'extraction_failed',
        truncated: false,
        reason: error.message,
        limits,
      };
    }
    throw error;
  }

  const baseResult = {
    messageId: raw.messageId,
    attachmentId: raw.attachmentId,
    filename: raw.filename,
    mimeType: raw.mimeType,
    size: raw.size,
    limits,
  };

  let buffer: Buffer;
  try {
    buffer = decodeBase64UrlData(raw.data);
  } catch (error) {
    return {
      ...baseResult,
      status: 'extraction_failed',
      truncated: false,
      reason: error instanceof Error ? error.message : 'Attachment data is not valid base64url',
    };
  }

  try {
    let extractedText: string;
    if (isTextLikeAttachment(raw.filename, raw.mimeType)) {
      extractedText = buffer.toString('utf8');
    } else if (isPdfAttachment(raw.filename, raw.mimeType)) {
      extractedText = await extractPdfText(buffer, limits.pdfMaxPages);
      if (!extractedText) {
        return {
          ...baseResult,
          status: 'unsupported',
          truncated: false,
          reason: 'PDF contains no extractable text; OCR is not implemented.',
        };
      }
    } else if (isDocxAttachment(raw.filename, raw.mimeType)) {
      extractedText = await extractDocxText(buffer, limits.docxMaxXmlBytes);
    } else {
      return {
        ...baseResult,
        status: 'unsupported',
        truncated: false,
        reason: unsupportedReason(raw.filename, raw.mimeType),
      };
    }

    const limited = limitDecodedText(extractedText, limits.maxCharacters);
    return {
      ...baseResult,
      status: 'decoded',
      text: limited.text,
      textEncoding: 'utf-8',
      truncated: limited.truncated,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'extraction_failed',
      truncated: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a message with file attachments using multipart/mixed MIME encoding.
 *
 * @param options Message content, recipients, and attachments
 * @param context Gmail API context
 * @returns Sent message info
 *
 * @example
 * ```typescript
 * const result = await sendWithAttachments({
 *   to: ['recipient@example.com'],
 *   subject: 'Here is the report',
 *   body: 'Please find the report attached.',
 *   attachments: [{
 *     filename: 'report.pdf',
 *     mimeType: 'application/pdf',
 *     data: pdfBase64String,
 *   }],
 * }, context);
 * ```
 */
export async function sendWithAttachments(
  options: SendWithAttachmentsOptions,
  context: GmailContext
): Promise<SendWithAttachmentsResult> {
  const { to, cc, bcc, subject, body, isHtml, from, attachments } = options;

  // Validate recipients (throws if any invalid)
  validateAndSanitizeRecipients(to, 'to');
  if (cc && cc.length > 0) {validateAndSanitizeRecipients(cc, 'cc');}
  if (bcc && bcc.length > 0) {validateAndSanitizeRecipients(bcc, 'bcc');}

  // Build params without passing undefined to optional fields (exactOptionalPropertyTypes)
  const messageParams: Parameters<typeof buildMultipartMessage>[0] = {
    to,
    subject,
    body,
    attachments: attachments || [],
  };
  if (cc && cc.length > 0) {messageParams.cc = cc;}
  if (bcc && bcc.length > 0) {messageParams.bcc = bcc;}
  if (isHtml !== undefined) {messageParams.isHtml = isHtml;}
  if (from) {messageParams.from = from;}

  // Build the multipart MIME message
  const emailMessage = buildMultipartMessage(messageParams);

  const encodedMessage = encodeToBase64Url(emailMessage);

  const response = await context.gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  const messageId = response.data.id;
  const threadId = response.data.threadId;
  const labelIds = response.data.labelIds || [];

  if (!messageId) {
    throw new Error('Failed to send message with attachments - no message ID returned');
  }

  await context.cacheManager.invalidate('gmail:list');
  await context.cacheManager.invalidate('gmail:search');

  context.performanceMonitor.track('gmail:sendWithAttachments', Date.now() - context.startTime);
  context.logger.info('Sent message with attachments', {
    messageId,
    to,
    subject,
    attachmentCount: attachments?.length || 0,
  });

  return {
    messageId,
    threadId: threadId || '',
    labelIds,
    message: 'Message sent successfully',
  };
}
