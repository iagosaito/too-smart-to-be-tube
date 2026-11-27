import { channelIdFromHref } from '../core/channels.js';
import { findAll } from './innertube.js';

// Converts YouTube's video formats (classic videoRenderer, the new lockupViewModel and
// shortsLockupViewModel) into a compact item, the same for the subscriptions feed and the channel
// tabs. We keep only what's needed to draw the card: the rest (thumbnail in other sizes, link) is
// derived from the video id.

const MINUTE = 60_000;
const UNIT_MS = {
  second: 1000, minute: MINUTE, hour: 60 * MINUTE, day: 1440 * MINUTE,
  week: 7 * 1440 * MINUTE, month: 30 * 1440 * MINUTE, year: 365 * 1440 * MINUTE,
};
const PT_UNITS = { segundo: 'second', minuto: 'minute', hora: 'hour', dia: 'day', semana: 'week', mes: 'month', mês: 'month', meses: 'month', ano: 'year' };
const EN_PATTERN = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i;
// The new layout shows the short form ("1d ago", "2mo ago"); "mo" comes before "m" on purpose.
const SHORT_PATTERN = /(\d+)\s*(mo|y|w|d|h|m|s)\s+ago/i;
const SHORT_UNITS = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week', mo: 'month', y: 'year' };
const PT_PATTERN = /há\s+(\d+)\s+(segundo|minuto|hora|dia|semana|mês|mes|meses|ano)/i;
// The feed shows only "911K" (with an eye icon) and puts "911 thousand views" in the accessibility
// label; that's why the spelled-out words also count.
const VIEWS_PATTERN = /([\d.,]+)\s*(K|M|B|thousand|million|billion)?\s*(views?|visualiza|vistas?)/i;
const VIEW_MULTIPLIERS = { k: 1e3, m: 1e6, b: 1e9, thousand: 1e3, million: 1e6, billion: 1e9 };
const VIDEO_ID = /^[\w-]{11}$/;

export function parseRelativeTime(text, now) {
  const english = text.match(EN_PATTERN);
  if (english) return now - Number(english[1]) * UNIT_MS[english[2].toLowerCase()];
  const short = text.match(SHORT_PATTERN);
  if (short) return now - Number(short[1]) * UNIT_MS[SHORT_UNITS[short[2].toLowerCase()]];
  const portuguese = text.match(PT_PATTERN);
  if (portuguese) return now - Number(portuguese[1]) * UNIT_MS[PT_UNITS[portuguese[2].toLowerCase()]];
  return null;
}

export function parseViewCount(text) {
  // "921K views", "1.7M views", "12,345 views": becomes a number so it can be formatted in the UI
  // language, instead of showing the English text.
  const match = String(text ?? '').match(VIEWS_PATTERN);
  if (!match) return null;
  const base = Number(match[2] ? match[1].replace(/,/g, '.') : match[1].replace(/[.,]/g, ''));
  return Number.isFinite(base) ? Math.round(base * (VIEW_MULTIPLIERS[match[2]?.toLowerCase()] ?? 1)) : null;
}

export function channelOf(node) {
  // The channel link appears in the video's author/avatar; the video's own link is a watchEndpoint,
  // so the first canonicalBaseUrl found is the channel's.
  const [baseUrl] = findAll(node, 'canonicalBaseUrl');
  return channelIdFromHref(baseUrl);
}

// The channel name also sits in the metadataRows, before the date. A channel called "1 second ago"
// would be read as the publish date, so parts that represent the author (an avatar or a link to a
// channel) are never considered.
function isNotAuthor(part) {
  return Boolean(part) && !part.avatarStack && findAll(part, 'browseEndpoint').length === 0;
}

function metadataTexts(node) {
  // Metadata fields only, never the title: a video called "3 days ago" must not become a date.
  // accessibilityLabel carries the spelled-out form ("1 day ago").
  const sources = [node.publishedTimeText, node.viewCountText, ...findAll(node, 'metadataParts').flat().filter(isNotAuthor)];
  const keys = ['simpleText', 'content', 'text', 'accessibilityLabel'];
  return sources.flatMap((source) => keys.flatMap((key) => findAll(source, key))).filter((text) => typeof text === 'string');
}

export function publishedAtOf(node, now) {
  for (const text of metadataTexts(node)) {
    const timestamp = parseRelativeTime(text, now);
    if (timestamp !== null) return timestamp;
  }
  return null;
}

function viewCountOf(node) {
  for (const text of metadataTexts(node)) {
    const count = parseViewCount(text);
    if (count !== null) return count;
  }
  return null;
}

function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.content ?? value.simpleText ?? (value.runs ?? []).map((run) => run.text).join('');
}

export function videoFromRenderer(renderer, now, fallbackChannelId = null) {
  return finishVideo({
    videoId: renderer.videoId,
    title: textOf(renderer.title),
    channelId: channelOf(renderer.ownerText ?? renderer.shortBylineText ?? {}) ?? fallbackChannelId,
    publishedAt: publishedAtOf(renderer, now),
    duration: textOf(renderer.lengthText),
    viewCount: viewCountOf(renderer),
  });
}

export function videoFromLockup(lockup, now, fallbackChannelId = null) {
  // Playlists, mixes and channels also use lockupViewModel; only videos matter.
  if (lockup.contentType && lockup.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null;
  const metadata = lockup.metadata?.lockupMetadataViewModel ?? {};
  const [badge] = findAll(lockup.contentImage ?? {}, 'thumbnailBadgeViewModel');
  return finishVideo({
    videoId: lockup.contentId ?? findAll(lockup, 'videoId')[0],
    title: textOf(metadata.title),
    channelId: channelOf(metadata) ?? fallbackChannelId,
    publishedAt: publishedAtOf(lockup, now),
    duration: textOf(badge?.text),
    viewCount: viewCountOf(lockup),
  });
}

function finishVideo(video) {
  // Without a valid id, title or date the card can't be shown or sorted (e.g. premieres and live
  // streams with no date yet).
  if (!VIDEO_ID.test(video.videoId ?? '') || !video.title || video.publishedAt === null) return null;
  return { ...video, duration: video.duration || '' };
}

export function shortFromLockup(lockup, channelId) {
  const videoId = lockup.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ?? String(lockup.entityId ?? '').replace('shorts-shelf-item-', '');
  const title = textOf(lockup.overlayMetadata?.primaryText);
  if (!VIDEO_ID.test(videoId) || !title) return null;
  // Shorts carry no publish date: the order comes from the position in the channel.
  return { videoId, title, channelId, viewCount: parseViewCount(textOf(lockup.overlayMetadata?.secondaryText)), thumbnail: verticalThumbnail(lockup) };
}

// YouTube already sends the cover at the card's size (405×720, ~40 KB); the one built from the id
// is 1080×1920 (~6× more pixels to decode per card). Only accepts images from i.ytimg.com: the URL
// goes straight into an <img>.
function verticalThumbnail(lockup) {
  const sources = lockup.thumbnailViewModel?.thumbnailViewModel?.image?.sources ?? [];
  // 9:16 like the card (there is also a 2:3 one, which would come out cropped).
  const vertical = sources.filter((source) => isNineBySixteen(source) && /^https:\/\/i\.ytimg\.com\//.test(source.url ?? ''));
  vertical.sort((a, b) => a.width * a.height - b.width * b.height);
  // The smallest one that is still sharp for the card (~200 px wide on 2x screens).
  return (vertical.find((source) => source.width >= 360) ?? vertical.at(-1))?.url ?? null;
}

// A generic page (feed or channel tab) → videos, without repeating the same id.
export function videosFromPage(data, now, fallbackChannelId = null) {
  const videos = [
    ...findAll(data, 'videoRenderer').map((renderer) => videoFromRenderer(renderer, now, fallbackChannelId)),
    ...findAll(data, 'gridVideoRenderer').map((renderer) => videoFromRenderer(renderer, now, fallbackChannelId)),
    ...findAll(data, 'lockupViewModel').map((lockup) => videoFromLockup(lockup, now, fallbackChannelId)),
  ];
  return uniqueById(videos.filter((video) => video?.channelId));
}

export function shortsFromPage(data, channelId) {
  return uniqueById(findAll(data, 'shortsLockupViewModel').map((lockup) => shortFromLockup(lockup, channelId)).filter(Boolean));
}

function uniqueById(items) {
  return [...new Map(items.map((item) => [item.videoId, item])).values()];
}

function isNineBySixteen({ width, height }) {
  return width > 0 && Math.abs(height / width - 16 / 9) < 0.05;
}

// Items cached by earlier versions don't have the cover: fall back to the URL built from the id.
export function shortThumbnail(short) {
  return short.thumbnail ?? thumbnailUrl(short.videoId, 'short');
}

export function thumbnailUrl(videoId, kind = 'video') {
  // mqdefault is 16:9 and light; oar2 is the vertical Shorts cover (9:16).
  return kind === 'short' ? `https://i.ytimg.com/vi/${videoId}/oar2.jpg` : `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function videoUrl(videoId, kind = 'video') {
  return kind === 'short' ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
}
