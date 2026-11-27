import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildAuthHeaders, readCookie, sapisidHash } from '../../src/youtube/auth.js';

const config = { sessionIndex: '0', delegatedSessionId: null };

describe('readCookie', () => {
  it('finds the cookie by its exact name', () => {
    const cookies = 'PREF=x; __Secure-3PAPISID=seguro; SAPISID=abc/def';
    expect(readCookie(cookies, 'SAPISID')).toBe('abc/def');
    expect(readCookie(cookies, '__Secure-3PAPISID')).toBe('seguro');
  });

  it("returns null when it doesn't exist", () => {
    expect(readCookie('', 'SAPISID')).toBeNull();
  });
});

describe('sapisidHash', () => {
  it('generates "timestamp_sha1(timestamp sapisid origin)"', async () => {
    const expected = createHash('sha1').update('100 abc https://www.youtube.com').digest('hex');
    expect(await sapisidHash('abc', 'https://www.youtube.com', 100)).toBe(`100_${expected}`);
  });
});

describe('buildAuthHeaders', () => {
  it('builds the headers with the timestamp in seconds', async () => {
    const headers = await buildAuthHeaders(config, 'SAPISID=abc', 100_999);
    expect(headers.Authorization).toMatch(/^SAPISIDHASH 100_[0-9a-f]{40}$/);
    expect(headers).toMatchObject({ 'X-Origin': 'https://www.youtube.com', 'X-Goog-AuthUser': '0' });
    expect(headers).not.toHaveProperty('X-Goog-PageId');
  });

  it('uses the secure cookie as a fallback and includes the brand account', async () => {
    const headers = await buildAuthHeaders({ ...config, delegatedSessionId: '42' }, '__Secure-3PAPISID=xyz');
    expect(headers.Authorization).toMatch(/^SAPISIDHASH /);
    expect(headers['X-Goog-PageId']).toBe('42');
  });

  it('fails with a translatable error when not logged in', async () => {
    await expect(buildAuthHeaders(config, 'PREF=x')).rejects.toMatchObject({ key: 'error.notSignedIn' });
  });
});
