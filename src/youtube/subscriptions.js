import { createChannel } from '../core/channels.js';
import { LocalizedError } from '../i18n/errors.js';
import { YOUTUBE_ORIGIN } from './auth.js';
import { continuationToken, fetchContinuation, fetchFirstPage, findAll } from './innertube.js';

// Reexportado: os testes e outros módulos já importavam findAll daqui.
export { findAll };

const CHANNELS_PAGE_URL = `${YOUTUBE_ORIGIN}/feed/channels`;
// Limite de segurança: evita laço infinito se o YouTube devolver sempre o mesmo token.
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
  // Lista vazia quase sempre significa sessão deslogada; falhar evita apagar o cache.
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
    // O handle (/@nome) é o mesmo id usado pelo menu lateral, mantendo as categorias consistentes.
    href: renderer.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? `/channel/${renderer.channelId}`,
    name: renderer.title?.simpleText ?? renderer.title?.runs?.[0]?.text,
    avatar: largestThumbnail(renderer.thumbnail),
  });
}

function largestThumbnail(thumbnail) {
  const url = thumbnail?.thumbnails?.at(-1)?.url ?? '';
  // O YouTube usa URLs relativas ao protocolo ("//yt3..."), que não funcionam fora do site.
  return url.startsWith('//') ? `https:${url}` : url;
}

function dedupeById(channels) {
  return [...new Map(channels.map((channel) => [channel.id, channel])).values()];
}
