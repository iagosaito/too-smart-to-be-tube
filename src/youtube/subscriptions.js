import { createChannel } from '../core/channels.js';
import { LocalizedError } from '../i18n/errors.js';
import { YOUTUBE_ORIGIN } from './auth.js';
import { continuationToken, fetchContinuation, fetchFirstPage, findAll } from './innertube.js';

// Re-exported: tests and other modules already imported findAll from here.
export { findAll };

const CHANNELS_PAGE_URL = `${YOUTUBE_ORIGIN}/feed/channels`;
// Safety limit: avoids an infinite loop if YouTube keeps returning the same token.
const MAX_PAGES = 100;

export async function fetchAllSubscriptions({ fetchFn = fetch, cookie = document.cookie } = {}) {
  const { config, firstPage } = await fetchChannelsPage(fetchFn);
  const channels = [...firstPage.channels];
  let token = firstPage.token;
  for (let page = 0; token && page < MAX_PAGES; page += 1) {
    const next = parseChannelsPage(await fetchContinuation(fetchFn, config, token, cookie));
    channels.push(...next.channels);
    token = next.token;
  }
  return dedupeById(channels);
}

async function fetchChannelsPage(fetchFn) {
  const { config, data } = await fetchFirstPage(fetchFn, CHANNELS_PAGE_URL);
  const firstPage = data ? parseChannelsPage(data) : { channels: [], token: null };
  // An empty list almost always means a logged-out session; failing avoids wiping the cache.
  if (!firstPage.channels.length) throw new LocalizedError('error.noSubscriptions');
  return { config, firstPage };
}

export function parseChannelsPage(data) {
  return {
    channels: findAll(data, 'channelRenderer').map(rendererToChannel).filter(Boolean),
    token: continuationToken(data),
  };
}

export function rendererToChannel(renderer) {
  return createChannel({
    // The handle (/@name) is the same id the sidebar uses, keeping categories consistent.
    href: renderer.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? `/channel/${renderer.channelId}`,
    name: renderer.title?.simpleText ?? renderer.title?.runs?.[0]?.text,
    avatar: largestThumbnail(renderer.thumbnail),
    ucid: renderer.channelId,
  });
}

function largestThumbnail(thumbnail) {
  const url = thumbnail?.thumbnails?.at(-1)?.url ?? '';
  // YouTube uses protocol-relative URLs ("//yt3..."), which don't work outside the site.
  return url.startsWith('//') ? `https:${url}` : url;
}

function dedupeById(channels) {
  return [...new Map(channels.map((channel) => [channel.id, channel])).values()];
}
