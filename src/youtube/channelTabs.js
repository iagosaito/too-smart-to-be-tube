import { LocalizedError } from '../i18n/errors.js';
import { YOUTUBE_ORIGIN } from './auth.js';
import { shortsFromPage, videosFromPage } from './videoItems.js';

// Parâmetros das abas "Videos" e "Shorts" de um canal, como o próprio
// YouTube envia ao trocar de aba (lidos de uma página real de canal).
export const CHANNEL_TAB_PARAMS = {
  videos: 'EgZ2aWRlb3PyBgQKAjoA',
  shorts: 'EgZzaG9ydHPyBgUKA5oBAA==',
};
const BROWSE_URL = `${YOUTUBE_ORIGIN}/youtubei/v1/browse?prettyPrint=false`;

// Busca uma aba de um canal **sem cookies** (credentials: 'omit'): vídeos e
// Shorts de um canal são públicos, então a requisição não fica associada à
// conta do usuário — sem risco para a conta, mesmo com várias consultas.
export async function fetchChannelTab({ channel, tab, clientVersion, fetchFn = fetch, now = Date.now() }) {
  const body = JSON.stringify({
    context: { client: { clientName: 'WEB', clientVersion, hl: 'en' } },
    browseId: channel.ucid,
    params: CHANNEL_TAB_PARAMS[tab],
  });
  const response = await fetchFn(BROWSE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'omit' });
  if (!response.ok) throw new LocalizedError('error.http', { status: response.status });
  const data = await response.json();
  return tab === 'shorts' ? shortsFromPage(data, channel.id) : videosFromPage(data, now, channel.id);
}
