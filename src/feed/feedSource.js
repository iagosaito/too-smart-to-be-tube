import { LocalizedError } from '../i18n/errors.js';
import { fetchChannelTab } from '../youtube/channelTabs.js';

// Single entry point to get a channel's tab: the cache first; if it isn't there, the public request
// goes through the queue (paced) and the result is stored.
export function createFeedSource({ cache, queue, clientVersion, fetchTab = fetchChannelTab }) {
  // Requests in flight per channel and tab: a new session (channel added to the category, page
  // reopened) reuses the one already queued instead of requesting the same channel again.
  const inFlight = new Map();

  async function fetchAndCache(channel, tab) {
    const hit = await cache.get(channel, tab);
    if (hit) return hit;
    const version = clientVersion();
    if (!version) throw new LocalizedError('error.feedUnavailable');
    const items = await queue.run(() => fetchTab({ channel, tab, clientVersion: version }));
    await cache.set(channel, tab, items);
    return items;
  }

  return {
    cached: (channel, tab) => cache.get(channel, tab),
    load(channel, tab) {
      const key = `${channel.ucid ?? channel.id}:${tab}`;
      if (!inFlight.has(key)) {
        // Leaves the map when it finishes, with success or failure: a failure doesn't get stuck and
        // the next request queries again.
        inFlight.set(key, fetchAndCache(channel, tab).finally(() => inFlight.delete(key)));
      }
      return inFlight.get(key);
    },
  };
}
