import { LocalizedError } from '../i18n/errors.js';
import { buildAuthHeaders, YOUTUBE_ORIGIN } from './auth.js';
import { extractConfig, extractInitialData } from './pageData.js';

// Peças comuns para ler páginas do YouTube via a API interna (InnerTube):
// a lista de inscrições e o feed de vídeos usam o mesmo fluxo de
// "HTML da primeira página + continuações paginadas".

export async function fetchFirstPage(fetchFn, url) {
  // O HTML traz junto a configuração da sessão (versão do cliente, conta
  // ativa), necessária para pedir as próximas páginas.
  const html = await (await fetchFn(url, { credentials: 'include' })).text();
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

// Busca por chave em qualquer profundidade em vez de um caminho fixo: o
// aninhamento do JSON do YouTube muda com frequência, os nomes dos renderers não.
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
