import { LocalizedError } from '../i18n/errors.js';
import { YOUTUBE_ORIGIN } from './auth.js';
import { continuationToken, fetchContinuation, fetchFirstPage } from './innertube.js';
import { videosFromPage } from './videoItems.js';

// Re-exported: tests and other modules already imported it from here.
export { parseRelativeTime } from './videoItems.js';

// We request the feed in English: the date text ("3 days ago") stays predictable regardless of the
// account's language. Portuguese stays as a fallback.
const FEED_URL = `${YOUTUBE_ORIGIN}/feed/subscriptions?hl=en`;
// The feed covers a few weeks; more pages than this would bring little and cost requests.
const MAX_PAGES = 15;

export async function fetchSubscriptionFeed({ fetchFn = fetch, cookie = document.cookie, now = Date.now() } = {}) {
  const { config, data } = await fetchFirstPage(fetchFn, FEED_URL);
  if (!data) throw new LocalizedError('error.feedUnavailable');
  const videos = videosFromPage(data, now);
  let token = continuationToken(data);
  for (let page = 0; token && page < MAX_PAGES; page += 1) {
    const next = await fetchContinuation(fetchFn, config, token, cookie, { hl: 'en' });
    videos.push(...videosFromPage(next, now));
    token = continuationToken(next);
  }
  // Newest first: the order in which the per-category feed shows them.
  return [...new Map(videos.map((video) => [video.videoId, video])).values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

export async function fetchLatestUploads(options) {
  return latestByChannel(await fetchSubscriptionFeed(options));
}

export function parseFeedPage(data, now) {
  return videosFromPage(data, now).map(({ channelId, publishedAt }) => ({ channelId, publishedAt }));
}

export function latestByChannel(items) {
  const latest = {};
  for (const { channelId, publishedAt } of items) {
    latest[channelId] = Math.max(latest[channelId] ?? 0, publishedAt);
  }
  return latest;
}
