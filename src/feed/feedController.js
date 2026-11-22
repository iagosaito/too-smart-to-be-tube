import { categoryVideos, FEED_TAB, interleave, nextChannels, orderByActivity } from './categoryFeed.js';

// Estado do feed de uma página de Categorias: uma sessão por categoria e aba.
// Duas medidas separadas: a tela mostra uma página de itens por vez e os
// canais são consultados em lotes só quando o que já foi baixado não enche a
// próxima página (cada canal traz dezenas de Shorts: um lote rende várias
// páginas sem nenhuma requisição nova). Tudo por ação explícita ("Carregar
// mais"), exceto o primeiro lote de Shorts, que é a intenção de quem abriu a aba.
export const BATCH_SIZE = 8;
// 4 fileiras de 6 Shorts ou 8 de 3 vídeos: o bastante para rolar, pouco o
// bastante para o fim da página continuar perto.
export const PAGE_SIZE = 24;

export function createFeedController({ source, onChange, batchSize = BATCH_SIZE, pageSize = PAGE_SIZE }) {
  const sessions = new Map();

  function sessionFor(category, tab, channels, latestUploads) {
    const signature = `${category.id}:${tab}:${channels.map((channel) => channel.id).join(',')}`;
    if (sessions.get(`${category.id}:${tab}`)?.signature !== signature) {
      const session = { signature, tab, ordered: orderByActivity(channels, latestUploads), requested: new Set(), results: new Map(), pending: new Set(), errorKey: null, visible: pageSize };
      sessions.set(`${category.id}:${tab}`, session);
      // O primeiro lote de Shorts espera o cache: canais já em cache não devem
      // ocupar vagas do lote que vai à rede, e se o cache já enche a primeira
      // página nada vai à rede.
      hydrateFromCache(session).then(() => tab === FEED_TAB.SHORTS && fillPage(session));
    }
    return sessions.get(`${category.id}:${tab}`);
  }

  async function hydrateFromCache(session) {
    // Sem rede: tudo o que já está no cache aparece sem custo.
    const cached = await Promise.all(session.ordered.filter((channel) => channel.ucid).map(async (channel) => [channel, await source.cached(channel, session.tab)]));
    for (const [channel, items] of cached) {
      if (!items || session.requested.has(channel.id)) continue;
      session.requested.add(channel.id);
      session.results.set(channel.id, items);
    }
    if (cached.some(([, items]) => items)) onChange();
  }

  // Mostra a próxima página; só consulta canais se o que já foi baixado não
  // bastar para preenchê-la.
  function loadMore(session, feedItems = []) {
    session.visible += pageSize;
    fillPage(session, feedItems);
  }

  function fillPage(session, feedItems = []) {
    session.errorKey = null;
    if (allItems(session, feedItems).length < session.visible) {
      for (const channel of nextChannels(session.ordered, session.requested, batchSize)) loadChannel(session, channel);
    }
    onChange();
  }

  function loadChannel(session, channel) {
    session.requested.add(channel.id);
    session.pending.add(channel.id);
    source.load(channel, session.tab)
      .then((items) => session.results.set(channel.id, items))
      .catch((error) => {
        // Libera o canal para uma nova tentativa e mostra o motivo (ex.: limite de consultas).
        session.requested.delete(channel.id);
        session.errorKey = error?.key ?? 'error.feedUnavailable';
      })
      .finally(() => {
        session.pending.delete(channel.id);
        onChange();
      });
  }

  return { sessionFor, loadMore, modelOf };
}

function allItems(session, feedItems) {
  const lists = session.ordered.filter((channel) => session.results.has(channel.id)).map((channel) => session.results.get(channel.id));
  return session.tab === FEED_TAB.SHORTS ? interleave(lists) : categoryVideos(feedItems, session.ordered.map((channel) => channel.id), lists);
}

export function modelOf(session, feedItems = []) {
  const items = allItems(session, feedItems);
  return {
    items: items.slice(0, session.visible),
    loading: session.pending.size,
    // Há mais se ainda sobra algo já baixado ou algum canal por consultar.
    hasMore: items.length > session.visible || nextChannels(session.ordered, session.requested, 1).length > 0,
    missingIds: session.ordered.filter((channel) => !channel.ucid).length,
    channelCount: session.ordered.length,
    errorKey: session.errorKey,
  };
}
