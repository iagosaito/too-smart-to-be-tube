import { LocalizedError } from '../i18n/errors.js';
import { buildAuthHeaders, YOUTUBE_ORIGIN } from './auth.js';
import { extractConfig, extractInitialData } from './pageData.js';

// Shared pieces for reading YouTube pages through the internal API (InnerTube): the subscriptions
// list and the video feed use the same "first page HTML + paginated continuations" flow.

export async function fetchFirstPage(fetchFn, url) {
  // The HTML also carries the session config (client version, active account), needed to request
  // the next pages.
  const response = await fetchFn(url, { credentials: 'include' });
  // The status matters: a 429 must pause every request, not read as "no data".
  if (response.ok === false) throw new LocalizedError('error.http', { status: response.status });
  const html = await response.text();
  return { config: extractConfig(html), data: extractInitialData(html) };
}

export async function fetchContinuation(fetchFn, config, token, cookie, { hl } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(await buildAuthHeaders(config, cookie)) };
  const client = { clientName: 'WEB', clientVersion: config.clientVersion, ...(hl ? { hl } : {}) };
  const body = JSON.stringify({ context: { client }, continuation: token });
  const query = config.apiKey ? `?key=${config.apiKey}&prettyPrint=false` : '?prettyPrint=false';
  const response = await fetchFn(`${YOUTUBE_ORIGIN}/youtubei/v1/browse${query}`, { method: 'POST', headers, body, credentials: 'include' });
  if (!response.ok) throw new LocalizedError('error.http', { status: response.status });
  return response.json();
}

export function continuationToken(data) {
  const continuation = findAll(data, 'continuationItemRenderer')[0];
  return continuation?.continuationEndpoint?.continuationCommand?.token ?? null;
}

// Searches for a key at any depth instead of a fixed path: the nesting of YouTube's JSON changes
// often, the renderer names don't.
export function findAll(node, key, found = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => findAll(item, key, found));
  } else if (node && typeof node === 'object') {
    for (const [childKey, value] of Object.entries(node)) {
      if (childKey === key) found.push(value);
      else findAll(value, key, found);
    }
  }
  return found;
}
