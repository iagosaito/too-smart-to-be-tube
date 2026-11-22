import { channelIdFromHref } from '../core/channels.js';
import { findAll } from './innertube.js';

// Converte os formatos de vídeo do YouTube (videoRenderer clássico,
// lockupViewModel novo e shortsLockupViewModel) num item compacto, o mesmo
// para o feed de Inscrições e para as abas dos canais. Guardamos só o
// necessário para desenhar o cartão: o resto (miniatura em outros tamanhos,
// link) é derivado do id do vídeo.

const MINUTE = 60_000;
const UNIT_MS = {
  second: 1000, minute: MINUTE, hour: 60 * MINUTE, day: 1440 * MINUTE,
  week: 7 * 1440 * MINUTE, month: 30 * 1440 * MINUTE, year: 365 * 1440 * MINUTE,
};
const PT_UNITS = { segundo: 'second', minuto: 'minute', hora: 'hour', dia: 'day', semana: 'week', mes: 'month', mês: 'month', meses: 'month', ano: 'year' };
const EN_PATTERN = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i;
// O layout novo mostra a forma curta ("1d ago", "2mo ago"); "mo" vem antes de "m" de propósito.
const SHORT_PATTERN = /(\d+)\s*(mo|y|w|d|h|m|s)\s+ago/i;
const SHORT_UNITS = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week', mo: 'month', y: 'year' };
const PT_PATTERN = /há\s+(\d+)\s+(segundo|minuto|hora|dia|semana|mês|mes|meses|ano)/i;
// O feed mostra só "911K" (com um ícone de olho) e põe "911 thousand views"
// no rótulo de acessibilidade; por isso as palavras por extenso também valem.
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
  // "921K views", "1.7M views", "12,345 views": vira número para ser
  // formatado no idioma da interface, em vez de mostrar o texto em inglês.
  const match = String(text ?? '').match(VIEWS_PATTERN);
  if (!match) return null;
  const base = Number(match[2] ? match[1].replace(/,/g, '.') : match[1].replace(/[.,]/g, ''));
  return Number.isFinite(base) ? Math.round(base * (VIEW_MULTIPLIERS[match[2]?.toLowerCase()] ?? 1)) : null;
}

export function channelOf(node) {
  // O link do canal aparece no autor/avatar do vídeo; o do próprio vídeo é um
  // watchEndpoint, então o primeiro canonicalBaseUrl encontrado é o do canal.
  const [baseUrl] = findAll(node, 'canonicalBaseUrl');
  return channelIdFromHref(baseUrl);
}

// O nome do canal também fica nas metadataRows, antes da data. Um canal
// chamado "1 second ago" seria lido como data de publicação, então partes que
// representam o autor (avatar ou link para um canal) nunca são consideradas.
function isNotAuthor(part) {
  return Boolean(part) && !part.avatarStack && findAll(part, 'browseEndpoint').length === 0;
}

function metadataTexts(node) {
  // Só campos de metadados, nunca o título: um vídeo chamado "3 days ago" não
  // pode virar data. accessibilityLabel traz a forma por extenso ("1 day ago").
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
  // Playlists, mixes e canais também usam lockupViewModel; só vídeos interessam.
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
  // Sem id válido, título ou data o cartão não tem como ser mostrado nem ordenado
  // (ex.: estreias e lives ainda sem data).
  if (!VIDEO_ID.test(video.videoId ?? '') || !video.title || video.publishedAt === null) return null;
  return { ...video, duration: video.duration || '' };
}

export function shortFromLockup(lockup, channelId) {
  const videoId = lockup.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ?? String(lockup.entityId ?? '').replace('shorts-shelf-item-', '');
  const title = textOf(lockup.overlayMetadata?.primaryText);
  if (!VIDEO_ID.test(videoId) || !title) return null;
  // Shorts não trazem data de publicação: a ordem vem da posição no canal.
  return { videoId, title, channelId, viewCount: parseViewCount(textOf(lockup.overlayMetadata?.secondaryText)) };
}

// Página genérica (feed ou aba de canal) → vídeos, sem repetir o mesmo id.
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

export function thumbnailUrl(videoId, kind = 'video') {
  // mqdefault é 16:9 e leve; oar2 é a capa vertical dos Shorts (9:16).
  return kind === 'short' ? `https://i.ytimg.com/vi/${videoId}/oar2.jpg` : `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function videoUrl(videoId, kind = 'video') {
  return kind === 'short' ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
}
