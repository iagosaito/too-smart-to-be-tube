// Cache das abas de canal (vídeos e Shorts) em memória, persistido no storage.
// Revisitar uma categoria não refaz consultas enquanto o cache estiver fresco.

export const CACHE_TTL_MS = { videos: 3 * 3_600_000, shorts: 6 * 3_600_000 };
// Limite por canal (cada um ocupa até duas entradas, Vídeos e Shorts): uma
// categoria grande vista nas duas abas não descarta o próprio cache.
export const MAX_CACHED_CHANNELS = 150;
// Itens por canal guardados: o suficiente para algumas telas de feed.
const MAX_ITEMS_PER_ENTRY = 30;
const PERSIST_DELAY_MS = 1000;

// storage guarda cada canal e aba numa chave própria, mais um índice pequeno
// (só as datas) para o LRU. Cada gravação leva só o que mudou: o
// storage.onChanged de todas as abas do YouTube recebe alguns KB, não o cache
// inteiro (~1 MB).
export function createChannelTabCache({ storage, now = Date.now }) {
  // Entradas já lidas nesta aba (null = não existe no storage).
  const entries = new Map();
  const changed = new Set();
  const touched = new Set();
  let persistTimer = null;
  const keyOf = (channel, tab) => `${channel.ucid}:${tab}`;

  async function entryFor(key) {
    // Lida sob demanda: outra aba pode ter gravado este canal.
    if (!entries.has(key) || !entries.get(key)) entries.set(key, await storage.loadEntry(key).catch(() => null));
    return entries.get(key);
  }

  async function persist() {
    const keys = [...new Set([...changed, ...touched])].filter((key) => entries.get(key));
    const local = Object.fromEntries(keys.map((key) => [key, summaryOf(entries.get(key))]));
    const toSave = Object.fromEntries([...changed].filter((key) => entries.get(key)).map((key) => [key, entries.get(key)]));
    changed.clear();
    touched.clear();
    // Outras abas gravam no mesmo storage: mescla o índice antes de gravar.
    const index = mergeEntries(await storage.loadIndex().catch(() => ({})), local);
    const evicted = evictOldest(index);
    for (const key of evicted) {
      entries.delete(key);
      delete toSave[key];
    }
    await storage.saveEntries(toSave);
    await storage.saveIndex(index);
    if (evicted.length) await storage.removeEntries(evicted);
  }

  function persistSoon() {
    // Agrupa várias gravações (um lote de canais) numa só escrita no storage.
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persist().catch(() => {}), PERSIST_DELAY_MS);
  }

  return {
    async get(channel, tab) {
      const key = keyOf(channel, tab);
      const entry = await entryFor(key);
      if (!entry || now() - entry.fetchedAt > CACHE_TTL_MS[tab]) return null;
      entry.usedAt = now();
      touched.add(key);
      persistSoon();
      return entry.items;
    },
    async set(channel, tab, items) {
      const key = keyOf(channel, tab);
      entries.set(key, { fetchedAt: now(), usedAt: now(), items: items.slice(0, MAX_ITEMS_PER_ENTRY) });
      changed.add(key);
      persistSoon();
    },
  };
}

function summaryOf(entry) {
  return { fetchedAt: entry.fetchedAt, usedAt: entry.usedAt };
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

// Remove do índice os canais usados há mais tempo (com as duas abas) quando
// passa do limite (LRU) e devolve as chaves removidas.
function evictOldest(index) {
  const channelOf = (key) => key.slice(0, key.lastIndexOf(':'));
  const lastUse = new Map();
  for (const [key, entry] of Object.entries(index)) lastUse.set(channelOf(key), Math.max(lastUse.get(channelOf(key)) ?? 0, entry.usedAt));
  if (lastUse.size <= MAX_CACHED_CHANNELS) return [];
  const evicted = new Set([...lastUse.keys()].sort((a, b) => lastUse.get(a) - lastUse.get(b)).slice(0, lastUse.size - MAX_CACHED_CHANNELS));
  const keys = Object.keys(index).filter((key) => evicted.has(channelOf(key)));
  for (const key of keys) delete index[key];
  return keys;
}
