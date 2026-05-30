/**
 * Tests for Gmail attachment operations - listAttachments, downloadAttachment, sendWithAttachments
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import JSZip from 'jszip';
import { listAttachments, downloadAttachment, readAttachmentText, sendWithAttachments } from '../attachments.js';

const mockPdfDestroy = jest.fn(async () => undefined);
const mockPdfCleanup = jest.fn(async () => undefined);
const mockPdfGetTextContent = jest.fn(async () => ({
  items: [{ str: 'Hello PDF Text' }],
}));
const mockPdfGetPage = jest.fn(async () => ({
  getTextContent: mockPdfGetTextContent,
}));
const mockPdfGetDocument = jest.fn(() => ({
  promise: Promise.resolve({
    numPages: 1,
    getPage: mockPdfGetPage,
    cleanup: mockPdfCleanup,
  }),
  destroy: mockPdfDestroy,
}));

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockPdfGetDocument,
}));

jest.mock('pdfjs-dist/legacy/build/pdf.worker.mjs', () => ({
  WorkerMessageHandler: { setup: jest.fn() },
}));

describe('listAttachments', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockPdfDestroy.mockClear();
    mockPdfCleanup.mockClear();
    mockPdfGetTextContent.mockClear();
    mockPdfGetTextContent.mockResolvedValue({
      items: [{ str: 'Hello PDF Text' }],
    });
    mockPdfGetPage.mockClear();
    mockPdfGetPage.mockResolvedValue({
      getTextContent: mockPdfGetTextContent,
    });
    mockPdfGetDocument.mockClear();
    mockPdfGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockPdfGetPage,
        cleanup: mockPdfCleanup,
      }),
      destroy: mockPdfDestroy,
    });

    mockGmailApi = {
      users: {
        messages: {
          get: jest.fn(),
        },
      },
    };

    mockContext = {
      gmail: mockGmailApi,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('returns attachment metadata for messages with attachments', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [
            { name: 'Subject', value: 'Email with attachment' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('Body text').toString('base64url') },
            },
            {
              mimeType: 'application/pdf',
              filename: 'document.pdf',
              body: {
                attachmentId: 'att123',
                size: 12345,
              },
            },
          ],
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0]!;
    expect(att.filename).toBe('document.pdf');
    expect(att.mimeType).toBe('application/pdf');
    expect(att.attachmentId).toMatch(/^part_/);
    expect(att.size).toBe(12345);
  });

  test('returns empty array for messages with no attachments', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'Subject', value: 'Simple email' },
          ],
          body: { data: Buffer.from('Just text').toString('base64url') },
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments).toHaveLength(0);
  });

  test('includes filename, mimeType, size, and attachmentId per attachment', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'image/png',
              filename: 'photo.png',
              body: {
                attachmentId: 'attXYZ',
                size: 98765,
              },
            },
          ],
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments[0]!).toMatchObject({
      filename: 'photo.png',
      mimeType: 'image/png',
      size: 98765,
    });
    expect(result.attachments[0]!.attachmentId).toMatch(/^part_/);
  });

  test('handles multiple attachments', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        threadId: 'thread123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('text').toString('base64url') },
            },
            {
              mimeType: 'application/pdf',
              filename: 'file1.pdf',
              body: { attachmentId: 'att1', size: 1000 },
            },
            {
              mimeType: 'image/jpeg',
              filename: 'photo.jpg',
              body: { attachmentId: 'att2', size: 2000 },
            },
          ],
        },
      },
    });

    const result = await listAttachments({ messageId: 'msg123' }, mockContext);

    expect(result.attachments).toHaveLength(2);
  });
});

describe('downloadAttachment', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          attachments: {
            get: jest.fn(),
          },
          get: jest.fn(),
        },
      },
    };

    mockContext = {
      gmail: mockGmailApi,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('calls users.messages.attachments.get with correct params', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'application/pdf',
              filename: 'doc.pdf',
              body: { attachmentId: 'att123', size: 500 },
            },
          ],
        },
      },
    });

    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 500,
        data: Buffer.from('PDF content').toString('base64url'),
      },
    });

    await downloadAttachment(
      { messageId: 'msg123', attachmentId: 'att123' },
      mockContext
    );

    expect(mockGmailApi.users.messages.attachments.get).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        messageId: 'msg123',
        id: 'att123',
      })
    );
  });

  test('returns base64-encoded attachment data', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'att123', size: 100 },
            },
          ],
        },
      },
    });

    const attachmentData = Buffer.from('File content here').toString('base64url');
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 100,
        data: attachmentData,
      },
    });

    const result = await downloadAttachment(
      { messageId: 'msg123', attachmentId: 'att123' },
      mockContext
    );

    expect(result.data).toBe(attachmentData);
  });

  test('downloads with opaque listAttachments IDs when Gmail raw IDs change between calls', async () => {
    const firstMessage = {
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'gmail-id-1', size: 100 },
            },
          ],
        },
      },
    };
    const secondMessage = {
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'gmail-id-2', size: 100 },
            },
          ],
        },
      },
    };
    mockGmailApi.users.messages.get
      .mockResolvedValueOnce(firstMessage)
      .mockResolvedValueOnce(secondMessage);
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 100,
        data: Buffer.from('File content here').toString('base64url'),
      },
    });

    const listed = await listAttachments({ messageId: 'msg123' }, mockContext);
    const result = await downloadAttachment(
      { messageId: 'msg123', attachmentId: listed.attachments[0]!.attachmentId },
      mockContext
    );

    expect(listed.attachments[0]!.attachmentId).toMatch(/^part_/);
    expect(mockGmailApi.users.messages.attachments.get).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'gmail-id-2' })
    );
    expect(result.filename).toBe('file.txt');
    expect(result.dataEncoding).toBe('base64url');
  });

  test('returns filename and mimeType in result', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'image/png',
              filename: 'image.png',
              body: { attachmentId: 'att999', size: 300 },
            },
          ],
        },
      },
    });

    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 300,
        data: Buffer.from('PNG data').toString('base64url'),
      },
    });

    const result = await downloadAttachment(
      { messageId: 'msg123', attachmentId: 'att999' },
      mockContext
    );

    expect(result.filename).toBe('image.png');
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBe(300);
  });

  test('returns explicit base64url encoding contract without logging content', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'att123', size: 100 },
            },
          ],
        },
      },
    });

    const attachmentData = Buffer.from('Sensitive file content').toString('base64url');
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 100,
        data: attachmentData,
      },
    });

    const result = await downloadAttachment(
      { messageId: 'msg123', attachmentId: 'att123' },
      mockContext
    );

    expect(result.data).toBe(attachmentData);
    expect(result.dataEncoding).toBe('base64url');
    expect(result.maxBytes).toBe(10 * 1024 * 1024);
    expect(JSON.stringify(mockContext.logger.info.mock.calls)).not.toContain(attachmentData);
  });

  test('throws a predictable error when attachment metadata is missing', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [],
        },
      },
    });

    await expect(
      downloadAttachment({ messageId: 'msg123', attachmentId: 'missing' }, mockContext)
    ).rejects.toThrow('Attachment metadata not found for requested attachmentId');
    expect(mockGmailApi.users.messages.attachments.get).not.toHaveBeenCalled();
  });

  test('rejects attachments above maxBytes before downloading content', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'application/pdf',
              filename: 'large.pdf',
              body: { attachmentId: 'att-large', size: 501 },
            },
          ],
        },
      },
    });

    await expect(
      downloadAttachment({ messageId: 'msg123', attachmentId: 'att-large', maxBytes: 500 }, mockContext)
    ).rejects.toThrow('Attachment exceeds maxBytes (501 > 500)');
    expect(mockGmailApi.users.messages.attachments.get).not.toHaveBeenCalled();
  });

  test('rejects returned data above maxBytes when Gmail underreports size', async () => {
    const attachmentData = Buffer.alloc(600, 'x').toString('base64url');
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'large.txt',
              body: { attachmentId: 'att-large', size: 10 },
            },
          ],
        },
      },
    });
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 10,
        data: attachmentData,
      },
    });

    await expect(
      downloadAttachment({ messageId: 'msg123', attachmentId: 'att-large', maxBytes: 500 }, mockContext)
    ).rejects.toThrow('Attachment exceeds maxBytes (600 > 500)');
  });

  test('rejects non-empty Gmail attachment responses without data', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'att123', size: 100 },
            },
          ],
        },
      },
    });
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 100,
      },
    });

    await expect(
      downloadAttachment({ messageId: 'msg123', attachmentId: 'att123' }, mockContext)
    ).rejects.toThrow('Gmail API returned attachment content without data');
  });

  test('preserves maxBytes errors when Gmail reports oversized content without data', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'att123', size: 100 },
            },
          ],
        },
      },
    });
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: 600,
      },
    });

    await expect(
      downloadAttachment({ messageId: 'msg123', attachmentId: 'att123', maxBytes: 500 }, mockContext)
    ).rejects.toThrow('Attachment exceeds maxBytes (600 > 500)');
  });

  test('wraps Gmail API attachment download failures without raw bytes', async () => {
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              filename: 'file.txt',
              body: { attachmentId: 'att123', size: 100 },
            },
          ],
        },
      },
    });
    mockGmailApi.users.messages.attachments.get.mockRejectedValue(new Error('raw-bytes: secret'));

    await expect(
      downloadAttachment({ messageId: 'msg123', attachmentId: 'att123' }, mockContext)
    ).rejects.toThrow('Gmail API failed while downloading attachment');
  });
});

describe('readAttachmentText', () => {
  let mockContext: any;
  let mockGmailApi: any;

  const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 24 Tf 72 720 Td (Hello PDF Text) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000241 00000 n
0000000335 00000 n
trailer << /Root 1 0 R /Size 6 >>
startxref
405
  %%EOF`;

  beforeEach(() => {
    mockPdfDestroy.mockClear();
    mockPdfCleanup.mockClear();
    mockPdfGetTextContent.mockClear();
    mockPdfGetTextContent.mockResolvedValue({
      items: [{ str: 'Hello PDF Text' }],
    });
    mockPdfGetPage.mockClear();
    mockPdfGetPage.mockResolvedValue({
      getTextContent: mockPdfGetTextContent,
    });
    mockPdfGetDocument.mockClear();
    mockPdfGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockPdfGetPage,
        cleanup: mockPdfCleanup,
      }),
      destroy: mockPdfDestroy,
    });

    mockGmailApi = {
      users: {
        messages: {
          attachments: {
            get: jest.fn(),
          },
          get: jest.fn(),
        },
      },
    };

    mockContext = {
      gmail: mockGmailApi,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  function mockDownloadableAttachment(filename: string, mimeType: string, data: string, size?: number) {
    const byteSize = size ?? Buffer.from(data, 'base64url').length;
    mockGmailApi.users.messages.get.mockResolvedValue({
      data: {
        id: 'msg123',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType,
              filename,
              body: { attachmentId: 'att123', size: byteSize },
            },
          ],
        },
      },
    });
    mockGmailApi.users.messages.attachments.get.mockResolvedValue({
      data: {
        size: byteSize,
        data,
      },
    });
  }

  function createStoredZip(
    entries: Array<{ name: string; data: string }>,
    declaredEntryCount = entries.length
  ): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let localOffset = 0;

    for (const entry of entries) {
      const name = Buffer.from(entry.name);
      const data = Buffer.from(entry.data);
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt32LE(0, 10);
      localHeader.writeUInt32LE(0, 14);
      localHeader.writeUInt32LE(data.byteLength, 18);
      localHeader.writeUInt32LE(data.byteLength, 22);
      localHeader.writeUInt16LE(name.byteLength, 26);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt32LE(0, 12);
      centralHeader.writeUInt32LE(0, 16);
      centralHeader.writeUInt32LE(data.byteLength, 20);
      centralHeader.writeUInt32LE(data.byteLength, 24);
      centralHeader.writeUInt16LE(name.byteLength, 28);
      centralHeader.writeUInt32LE(0, 34);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(localOffset, 42);

      localParts.push(localHeader, name, data);
      centralParts.push(centralHeader, name);
      localOffset += localHeader.byteLength + name.byteLength + data.byteLength;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(declaredEntryCount, 8);
    endOfCentralDirectory.writeUInt16LE(declaredEntryCount, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.byteLength, 12);
    endOfCentralDirectory.writeUInt32LE(localOffset, 16);

    return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
  }

  test('decodes text attachments as UTF-8', async () => {
    mockDownloadableAttachment(
      'notes.txt',
      'text/plain',
      Buffer.from('Plain attachment text').toString('base64url')
    );

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('decoded');
    expect(result.text).toBe('Plain attachment text');
    expect(result.textEncoding).toBe('utf-8');
    expect(result.truncated).toBe(false);
  });

  test('decodes CSV and JSON-like attachments', async () => {
    mockDownloadableAttachment(
      'data.json',
      'application/json',
      Buffer.from('{"ok":true,"rows":[1,2]}').toString('base64url')
    );

    const jsonResult = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);
    expect(jsonResult).toMatchObject({ status: 'decoded', text: '{"ok":true,"rows":[1,2]}' });

    mockDownloadableAttachment(
      'data.csv',
      'text/csv',
      Buffer.from('name,value\nalpha,1').toString('base64url')
    );

    const csvResult = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);
    expect(csvResult).toMatchObject({ status: 'decoded', text: 'name,value\nalpha,1' });
  });

  test('extracts text from PDFs with embedded text', async () => {
    mockDownloadableAttachment(
      'document.pdf',
      'application/pdf',
      Buffer.from(minimalPdf, 'latin1').toString('base64url')
    );

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('decoded');
    expect(result.text).toContain('Hello PDF Text');
  });

  test('destroys PDF loading tasks when extraction fails', async () => {
    mockDownloadableAttachment(
      'document.pdf',
      'application/pdf',
      Buffer.from(minimalPdf, 'latin1').toString('base64url')
    );
    mockPdfGetPage.mockRejectedValueOnce(new Error('page failed'));

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('extraction_failed');
    expect(result.reason).toBe('page failed');
    expect(mockPdfCleanup).toHaveBeenCalledTimes(1);
    expect(mockPdfDestroy).toHaveBeenCalledTimes(1);
  });

  test('extracts text from Word docx attachments', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    zip.file(
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX Text</w:t></w:r></w:p></w:body></w:document>'
    );
    const docx = await zip.generateAsync({ type: 'nodebuffer' });
    mockDownloadableAttachment(
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docx.toString('base64url')
    );

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('decoded');
    expect(result.text).toBe('Hello DOCX Text');
  });

  test('returns extraction_failed before inflating oversized DOCX document XML', async () => {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Large DOCX</w:t></w:r></w:p></w:body></w:document>'
    );
    const docx = await zip.generateAsync({ type: 'nodebuffer' });
    mockDownloadableAttachment(
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docx.toString('base64url')
    );

    const result = await readAttachmentText(
      { messageId: 'msg123', attachmentId: 'att123', docxMaxXmlBytes: 10 },
      mockContext
    );

    expect(result.status).toBe('extraction_failed');
    expect(result.reason).toContain('DOCX document.xml exceeds docxMaxXmlBytes');
  });

  test('returns extraction_failed for duplicate DOCX document XML entries', async () => {
    const docx = createStoredZip([
      {
        name: 'word/document.xml',
        data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Small</w:t></w:r></w:p></w:body></w:document>',
      },
      {
        name: 'word/document.xml',
        data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Duplicate</w:t></w:r></w:p></w:body></w:document>',
      },
    ]);
    mockDownloadableAttachment(
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docx.toString('base64url')
    );

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('extraction_failed');
    expect(result.reason).toContain('DOCX document.xml has duplicate ZIP entries');
  });

  test('returns extraction_failed for duplicate DOCX entries hidden by mismatched ZIP counts', async () => {
    const docx = createStoredZip(
      [
        {
          name: 'word/document.xml',
          data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Small</w:t></w:r></w:p></w:body></w:document>',
        },
        {
          name: 'word/document.xml',
          data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Duplicate</w:t></w:r></w:p></w:body></w:document>',
        },
      ],
      1
    );
    mockDownloadableAttachment(
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docx.toString('base64url')
    );

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('extraction_failed');
    expect(result.reason).toContain('DOCX document.xml has duplicate ZIP entries');
  });

  test('returns unsupported for unknown binary attachments', async () => {
    mockDownloadableAttachment(
      'archive.bin',
      'application/octet-stream',
      Buffer.from([0, 1, 2, 3]).toString('base64url')
    );

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('unsupported');
    expect(result.reason).toContain('Unsupported binary attachment type');
  });

  test('returns oversize when the attachment exceeds read limits', async () => {
    mockDownloadableAttachment(
      'large.txt',
      'text/plain',
      Buffer.from('too large').toString('base64url'),
      101
    );

    const result = await readAttachmentText(
      { messageId: 'msg123', attachmentId: 'att123', maxBytes: 100 },
      mockContext
    );

    expect(result.status).toBe('oversize');
    expect(result.reason).toBe('Attachment exceeds maxBytes (101 > 100)');
  });

  test('returns extraction_failed for malformed base64url data', async () => {
    mockDownloadableAttachment('broken.txt', 'text/plain', 'not valid base64url!', 10);

    const result = await readAttachmentText({ messageId: 'msg123', attachmentId: 'att123' }, mockContext);

    expect(result.status).toBe('extraction_failed');
    expect(result.reason).toBe('Attachment data is not valid base64url');
  });
});

describe('sendWithAttachments', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          send: jest.fn(),
        },
      },
    };

    mockContext = {
      gmail: mockGmailApi,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('builds multipart/mixed MIME message', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Email with file',
        body: 'Please see attached.',
        attachments: [
          {
            filename: 'test.txt',
            mimeType: 'text/plain',
            data: Buffer.from('file contents').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Content-Type: multipart/mixed');
  });

  test('includes text body as first part of multipart message', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Hello there, see attached.',
        attachments: [
          {
            filename: 'file.txt',
            mimeType: 'text/plain',
            data: Buffer.from('data').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Hello there, see attached.');
    expect(rawDecoded).toContain('Content-Type: text/plain');
  });

  test('encodes each attachment as base64 in MIME part', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    const attachmentContent = Buffer.from('attachment data here').toString('base64');

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'data.bin',
            mimeType: 'application/octet-stream',
            data: attachmentContent,
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Content-Transfer-Encoding: base64');
  });

  test('includes Content-Disposition: attachment header per part', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'report.pdf',
            mimeType: 'application/pdf',
            data: Buffer.from('pdf data').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toContain('Content-Disposition: attachment; filename="report.pdf"');
  });

  test('uses unique boundary string in Content-Type header', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'file.txt',
            mimeType: 'text/plain',
            data: Buffer.from('content').toString('base64'),
          },
        ],
      },
      mockContext
    );

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0];
    const rawDecoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString();
    expect(rawDecoded).toMatch(/Content-Type: multipart\/mixed; boundary="[^"]+"/);
  });

  test('validates all recipient email addresses', async () => {
    await expect(
      sendWithAttachments(
        {
          to: ['invalid-email'],
          subject: 'Test',
          body: 'Body',
          attachments: [],
        },
        mockContext
      )
    ).rejects.toThrow();
  });

  test('invalidates gmail:list and gmail:search caches', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      },
    });

    await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [
          {
            filename: 'file.txt',
            mimeType: 'text/plain',
            data: Buffer.from('content').toString('base64'),
          },
        ],
      },
      mockContext
    );

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith('gmail:search');
  });

  test('returns messageId, threadId, labelIds, and message', async () => {
    mockGmailApi.users.messages.send.mockResolvedValue({
      data: {
        id: 'sent999',
        threadId: 'thread999',
        labelIds: ['SENT', 'INBOX'],
      },
    });

    const result = await sendWithAttachments(
      {
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
        attachments: [],
      },
      mockContext
    );

    expect(result.messageId).toBe('sent999');
    expect(result.threadId).toBe('thread999');
    expect(result.labelIds).toEqual(['SENT', 'INBOX']);
    expect(result.message).toBe('Message sent successfully');
  });
});
