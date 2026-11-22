import { categoryVideos, FEED_TAB, interleave, nextChannels, orderByActivity } from './categoryFeed.js';

// Estado do feed de uma página de Categorias: uma sessão por categoria e aba.
// Canais com cache fresco entram na hora; os demais são buscados em lotes,
// sempre por ação explícita ("Carregar mais"), exceto o primeiro lote de
// Shorts, que é a intenção de quem abriu a aba.
export const BATCH_SIZE = 8;

export function createFeedController({ source, onChange, batchSize = BATCH_SIZE }) {
  const sessions = new Map();

  function sessionFor(category, tab, channels, latestUploads) {
    const signature = `${category.id}:${tab}:${channels.map((channel) => channel.id).join(',')}`;
    if (sessions.get(`${category.id}:${tab}`)?.signature !== signature) {
      const session = { signature, tab, ordered: orderByActivity(channels, latestUploads), requested: new Set(), results: new Map(), pending: new Set(), errorKey: null };
      sessions.set(`${category.id}:${tab}`, session);
      // O primeiro lote de Shorts espera o cache: canais já em cache não devem
      // ocupar vagas do lote que vai à rede.
      hydrateFromCache(session).then(() => tab === FEED_TAB.SHORTS && loadMore(session));
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

  function loadMore(session) {
    const batch = nextChannels(session.ordered, session.requested, batchSize);
    session.errorKey = null;
    for (const channel of batch) loadChannel(session, channel);
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

export function modelOf(session, feedItems = []) {
  const lists = session.ordered.filter((channel) => session.results.has(channel.id)).map((channel) => session.results.get(channel.id));
  const items = session.tab === FEED_TAB.SHORTS ? interleave(lists) : categoryVideos(feedItems, session.ordered.map((channel) => channel.id), lists);
  return {
    items,
    loading: session.pending.size,
    hasMore: nextChannels(session.ordered, session.requested, 1).length > 0,
    missingIds: session.ordered.filter((channel) => !channel.ucid).length,
    channelCount: session.ordered.length,
    errorKey: session.errorKey,
  };
}
