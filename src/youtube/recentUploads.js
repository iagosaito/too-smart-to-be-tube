import { LocalizedError } from '../i18n/errors.js';
import { YOUTUBE_ORIGIN } from './auth.js';
import { continuationToken, fetchContinuation, fetchFirstPage } from './innertube.js';
import { videosFromPage } from './videoItems.js';

// Reexportado: testes e outros módulos já importavam daqui.
export { parseRelativeTime } from './videoItems.js';

// Pedimos o feed em inglês: o texto de data ("3 days ago") fica previsível
// independentemente do idioma da conta. O português fica como reserva.
const FEED_URL = `${YOUTUBE_ORIGIN}/feed/subscriptions?hl=en`;
// O feed cobre algumas semanas; mais páginas que isso trariam pouco e custariam requisições.
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
  // Ordem mais recente primeiro: é a ordem em que o feed por categoria mostra.
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
