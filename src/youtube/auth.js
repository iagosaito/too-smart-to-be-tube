import { LocalizedError } from '../i18n/errors.js';

export const YOUTUBE_ORIGIN = 'https://www.youtube.com';

export function readCookie(cookieString, name) {
  const prefix = `${name}=`;
  const entry = cookieString.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

// The internal API (InnerTube) only returns account data with this header, which is the same one
// the YouTube site computes: SHA-1 of "timestamp SAPISID origin".
export async function sapisidHash(sapisid, origin, timestamp) {
  const bytes = new TextEncoder().encode(`${timestamp} ${sapisid} ${origin}`);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${timestamp}_${hex}`;
}

export async function buildAuthHeaders(config, cookieString, now = Date.now()) {
  // The secure cookie is the fallback because some browsers only expose that one.
  const sapisid = readCookie(cookieString, 'SAPISID') ?? readCookie(cookieString, '__Secure-3PAPISID');
  if (!sapisid) throw new LocalizedError('error.notSignedIn');

  const timestamp = Math.floor(now / 1000);
  const headers = {
    Authorization: `SAPISIDHASH ${await sapisidHash(sapisid, YOUTUBE_ORIGIN, timestamp)}`,
    'X-Origin': YOUTUBE_ORIGIN,
    'X-Goog-AuthUser': config.sessionIndex,
  };
  if (config.delegatedSessionId) headers['X-Goog-PageId'] = config.delegatedSessionId;
  return headers;
}
