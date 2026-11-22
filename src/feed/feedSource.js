import { LocalizedError } from '../i18n/errors.js';
import { fetchChannelTab } from '../youtube/channelTabs.js';

// Ponto único para obter a aba de um canal: primeiro o cache; se não houver,
// a consulta pública passa pela fila (ritmo controlado) e o resultado é guardado.
export function createFeedSource({ cache, queue, clientVersion, fetchTab = fetchChannelTab }) {
  // Consultas em andamento por canal e aba: uma sessão nova (canal adicionado
  // à categoria, página reaberta) reaproveita a que já está na fila em vez de
  // pedir o mesmo canal de novo.
  const inFlight = new Map();

  async function fetchAndCache(channel, tab) {
    const hit = await cache.get(channel, tab);
    if (hit) return hit;
    const version = clientVersion();
    if (!version) throw new LocalizedError('error.feedUnavailable');
    const items = await queue.run(() => fetchTab({ channel, tab, clientVersion: version }));
    await cache.set(channel, tab, items);
    return items;
  }

  return {
    cached: (channel, tab) => cache.get(channel, tab),
    load(channel, tab) {
      const key = `${channel.ucid ?? channel.id}:${tab}`;
      if (!inFlight.has(key)) {
        // Sai do mapa ao terminar, com sucesso ou falha: uma falha não fica
        // presa e o próximo pedido consulta de novo.
        inFlight.set(key, fetchAndCache(channel, tab).finally(() => inFlight.delete(key)));
      }
      return inFlight.get(key);
    },
  };
}
