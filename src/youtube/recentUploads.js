import { channelIdFromHref } from '../core/channels.js';
import { YOUTUBE_ORIGIN } from './auth.js';
import { continuationToken, fetchContinuation, fetchFirstPage, findAll } from './innertube.js';

// Pedimos o feed em inglês: o texto de data ("3 days ago") fica previsível
// independentemente do idioma da conta. O português fica como reserva.
const FEED_URL = `${YOUTUBE_ORIGIN}/feed/subscriptions?hl=en`;
// O feed cobre algumas semanas; mais páginas que isso trariam pouco e custariam requisições.
const MAX_PAGES = 15;
const VIDEO_NODES = ['videoRenderer', 'gridVideoRenderer', 'lockupViewModel'];

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

export async function fetchLatestUploads({ fetchFn = fetch, cookie = document.cookie, now = Date.now() } = {}) {
  const { config, data } = await fetchFirstPage(fetchFn, FEED_URL);
  if (!data) throw new Error('não foi possível ler o feed de inscrições');
  const items = parseFeedPage(data, now);
  let token = continuationToken(data);
  for (let page = 0; token && page < MAX_PAGES; page += 1) {
    const next = await fetchContinuation(fetchFn, config, token, cookie, { hl: 'en' });
    items.push(...parseFeedPage(next, now));
    token = continuationToken(next);
  }
  return latestByChannel(items);
}

export function parseFeedPage(data, now) {
  return VIDEO_NODES.flatMap((key) => findAll(data, key))
    .map((node) => ({ channelId: channelOf(node), publishedAt: publishedAtOf(node, now) }))
    .filter((item) => item.channelId && item.publishedAt !== null);
}

function channelOf(node) {
  // O link do canal aparece no autor/avatar do vídeo; o do próprio vídeo é um
  // watchEndpoint, então o primeiro canonicalBaseUrl encontrado é o do canal.
  const [baseUrl] = findAll(node, 'canonicalBaseUrl');
  return channelIdFromHref(baseUrl);
}

function publishedAtOf(node, now) {
  // Só olhamos os campos de data/metadados, nunca o título: um vídeo chamado
  // "3 days ago" não pode virar data de publicação.
  const sources = [node.publishedTimeText, ...findAll(node, 'metadataRows')];
  // accessibilityLabel traz a forma por extenso ("1 day ago") mesmo quando o texto visível é abreviado.
  const keys = ['simpleText', 'content', 'text', 'accessibilityLabel'];
  const texts = sources.flatMap((source) => keys.flatMap((key) => findAll(source, key)));
  for (const text of texts) {
    const timestamp = typeof text === 'string' ? parseRelativeTime(text, now) : null;
    if (timestamp !== null) return timestamp;
  }
  return null;
}

export function parseRelativeTime(text, now) {
  const english = text.match(EN_PATTERN);
  if (english) return now - Number(english[1]) * UNIT_MS[english[2].toLowerCase()];
  const short = text.match(SHORT_PATTERN);
  if (short) return now - Number(short[1]) * UNIT_MS[SHORT_UNITS[short[2].toLowerCase()]];
  const portuguese = text.match(PT_PATTERN);
  if (portuguese) return now - Number(portuguese[1]) * UNIT_MS[PT_UNITS[portuguese[2].toLowerCase()]];
  return null;
}

export function latestByChannel(items) {
  const latest = {};
  for (const { channelId, publishedAt } of items) {
    latest[channelId] = Math.max(latest[channelId] ?? 0, publishedAt);
  }
  return latest;
}
