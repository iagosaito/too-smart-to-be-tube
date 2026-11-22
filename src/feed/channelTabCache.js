// Cache das abas de canal (vídeos e Shorts) em memória, persistido no storage.
// Revisitar uma categoria não refaz consultas enquanto o cache estiver fresco.

export const CACHE_TTL_MS = { videos: 3 * 3_600_000, shorts: 6 * 3_600_000 };
export const MAX_CACHED_ENTRIES = 150;
// Itens por canal guardados: o suficiente para algumas telas de feed.
const MAX_ITEMS_PER_ENTRY = 30;
const PERSIST_DELAY_MS = 1000;

export function createChannelTabCache({ load, save, now = Date.now }) {
  let entries = null;
  let persistTimer = null;
  const keyOf = (channel, tab) => `${channel.ucid}:${tab}`;

  async function ready() {
    entries ??= await load().catch(() => ({}));
    return entries;
  }

  function persistSoon() {
    // Agrupa várias gravações (um lote de canais) numa só escrita no storage.
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => save(entries).catch(() => {}), PERSIST_DELAY_MS);
  }

  return {
    async get(channel, tab) {
      const entry = (await ready())[keyOf(channel, tab)];
      if (!entry || now() - entry.fetchedAt > CACHE_TTL_MS[tab]) return null;
      entry.usedAt = now();
      return entry.items;
    },
    async set(channel, tab, items) {
      const cache = await ready();
      cache[keyOf(channel, tab)] = { fetchedAt: now(), usedAt: now(), items: items.slice(0, MAX_ITEMS_PER_ENTRY) };
      evictOldest(cache);
      persistSoon();
    },
  };
}

function evictOldest(cache) {
  // Remove os usados há mais tempo quando passa do limite (LRU).
  const keys = Object.keys(cache);
  if (keys.length <= MAX_CACHED_ENTRIES) return;
  keys.sort((a, b) => cache[a].usedAt - cache[b].usedAt);
  for (const key of keys.slice(0, keys.length - MAX_CACHED_ENTRIES)) delete cache[key];
}
