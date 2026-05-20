import { describe, expect, it } from '@jest/globals';
import { validateBearerRequest } from '../../server/http-auth.js';

describe('validateBearerRequest', () => {
  it('returns 500 when the required server token is missing', async () => {
    const request = new Request('https://example.com/mcp', { method: 'POST' });

    const response = validateBearerRequest(request, {
      runtimeName: 'Test runtime',
    });

    expect(response?.status).toBe(500);
    expect(response?.headers.get('content-type')).toContain('application/json');
    const body = await response?.json();
    expect(body.error).toBe('Server misconfiguration');
    expect(body.detail).toBe('MCP_BEARER_TOKEN is not configured for Test runtime');
  });

  it('returns 401 for a missing Authorization header', async () => {
    const request = new Request('https://example.com/mcp', { method: 'POST' });

    const response = validateBearerRequest(request, {
      requiredToken: 'secret-token',
      runtimeName: 'Test runtime',
    });

    expect(response?.status).toBe(401);
    expect(response?.headers.get('www-authenticate')).toBe('Bearer');
    const body = await response?.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 for the wrong bearer token', async () => {
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-token',
      },
    });

    const response = validateBearerRequest(request, {
      requiredToken: 'secret-token',
      runtimeName: 'Test runtime',
    });

    expect(response?.status).toBe(401);
    expect(response?.headers.get('www-authenticate')).toBe('Bearer');
    const body = await response?.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 for a disallowed origin', async () => {
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        Origin: 'https://evil.example.com',
      },
    });

    const response = validateBearerRequest(request, {
      requiredToken: 'secret-token',
      allowedOrigins: 'https://trusted.example.com',
      runtimeName: 'Test runtime',
    });

    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.error).toBe('Forbidden');
  });

  it('allows a valid bearer token and allowed origin', () => {
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        Origin: 'https://trusted.example.com',
      },
    });

    const response = validateBearerRequest(request, {
      requiredToken: 'secret-token',
      allowedOrigins: 'https://trusted.example.com, https://other.example.com',
      runtimeName: 'Test runtime',
    });

    expect(response).toBeNull();
  });
});
