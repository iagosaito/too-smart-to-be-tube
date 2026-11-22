import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildAuthHeaders, readCookie, sapisidHash } from '../../src/youtube/auth.js';

const config = { sessionIndex: '0', delegatedSessionId: null };

describe('readCookie', () => {
  it('encontra o cookie pelo nome exato', () => {
    const cookies = 'PREF=x; __Secure-3PAPISID=seguro; SAPISID=abc/def';
    expect(readCookie(cookies, 'SAPISID')).toBe('abc/def');
    expect(readCookie(cookies, '__Secure-3PAPISID')).toBe('seguro');
  });

  it('retorna null quando não existe', () => {
    expect(readCookie('', 'SAPISID')).toBeNull();
  });
});

describe('sapisidHash', () => {
  it('gera "timestamp_sha1(timestamp sapisid origem)"', async () => {
    const expected = createHash('sha1').update('100 abc https://www.youtube.com').digest('hex');
    expect(await sapisidHash('abc', 'https://www.youtube.com', 100)).toBe(`100_${expected}`);
  });
});

describe('buildAuthHeaders', () => {
  it('monta os cabeçalhos com o timestamp em segundos', async () => {
    const headers = await buildAuthHeaders(config, 'SAPISID=abc', 100_999);
    expect(headers.Authorization).toMatch(/^SAPISIDHASH 100_[0-9a-f]{40}$/);
    expect(headers).toMatchObject({ 'X-Origin': 'https://www.youtube.com', 'X-Goog-AuthUser': '0' });
    expect(headers).not.toHaveProperty('X-Goog-PageId');
  });

  it('usa o cookie seguro como fallback e inclui a conta de marca', async () => {
    const headers = await buildAuthHeaders({ ...config, delegatedSessionId: '42' }, '__Secure-3PAPISID=xyz');
    expect(headers.Authorization).toMatch(/^SAPISIDHASH /);
    expect(headers['X-Goog-PageId']).toBe('42');
  });

  it('falha com um erro traduzível quando não está logado', async () => {
    await expect(buildAuthHeaders(config, 'PREF=x')).rejects.toMatchObject({ key: 'error.notSignedIn' });
  });
});
