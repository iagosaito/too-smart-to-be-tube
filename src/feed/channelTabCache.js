// Cache das abas de canal (vídeos e Shorts) em memória, persistido no storage.
// Revisitar uma categoria não refaz consultas enquanto o cache estiver fresco.

export const CACHE_TTL_MS = { videos: 3 * 3_600_000, shorts: 6 * 3_600_000 };
// Limite por canal (cada um ocupa até duas entradas, Vídeos e Shorts): uma
// categoria grande vista nas duas abas não descarta o próprio cache.
export const MAX_CACHED_CHANNELS = 150;
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

  async function persist() {
    // Outras abas do YouTube gravam no mesmo storage: relê e mescla antes de
    // gravar, senão a última aba apagaria o que as outras salvaram.
    const stored = await load().catch(() => ({}));
    entries = mergeEntries(stored, entries);
    evictOldest(entries);
    await save(entries);
  }

  function persistSoon() {
    // Agrupa várias gravações (um lote de canais) numa só escrita no storage.
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persist().catch(() => {}), PERSIST_DELAY_MS);
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

// Por chave, vale a consulta mais recente; o uso mais recente conta para o LRU.
export function mergeEntries(stored, local) {
  const merged = { ...stored };
  for (const [key, entry] of Object.entries(local)) {
    const other = merged[key];
    const newest = !other || entry.fetchedAt >= other.fetchedAt ? entry : other;
    merged[key] = { ...newest, usedAt: Math.max(entry.usedAt, other?.usedAt ?? 0) };
  }
  return merged;
}

function evictOldest(cache) {
  // Remove os canais usados há mais tempo (com as duas abas) quando passa do limite (LRU).
  const lastUse = new Map();
  for (const [key, entry] of Object.entries(cache)) {
    const ucid = key.slice(0, key.lastIndexOf(':'));
    lastUse.set(ucid, Math.max(lastUse.get(ucid) ?? 0, entry.usedAt));
  }
  if (lastUse.size <= MAX_CACHED_CHANNELS) return;
  const oldest = [...lastUse.keys()].sort((a, b) => lastUse.get(a) - lastUse.get(b)).slice(0, lastUse.size - MAX_CACHED_CHANNELS);
  const evicted = new Set(oldest);
  for (const key of Object.keys(cache)) if (evicted.has(key.slice(0, key.lastIndexOf(':')))) delete cache[key];
}
