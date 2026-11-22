import { LocalizedError } from '../i18n/errors.js';
import { fetchChannelTab } from '../youtube/channelTabs.js';

// Ponto único para obter a aba de um canal: primeiro o cache; se não houver,
// a consulta pública passa pela fila (ritmo controlado) e o resultado é guardado.
export function createFeedSource({ cache, queue, clientVersion, fetchTab = fetchChannelTab }) {
  return {
    cached: (channel, tab) => cache.get(channel, tab),
    async load(channel, tab) {
      const hit = await cache.get(channel, tab);
      if (hit) return hit;
      const version = clientVersion();
      if (!version) throw new LocalizedError('error.feedUnavailable');
      const items = await queue.run(() => fetchTab({ channel, tab, clientVersion: version }));
      await cache.set(channel, tab, items);
      return items;
    },
  };
}
