// In-memory cache of channel tabs (videos and Shorts), persisted to storage. Revisiting a category
// doesn't repeat requests while the cache is fresh.

export const CACHE_TTL_MS = { videos: 3 * 3_600_000, shorts: 6 * 3_600_000 };
// Per-channel limit (each one takes up to two entries, Videos and Shorts): a large category viewed
// in both tabs doesn't evict its own cache.
export const MAX_CACHED_CHANNELS = 150;
// Items stored per channel: enough for a few feed screens.
const MAX_ITEMS_PER_ENTRY = 30;
const PERSIST_DELAY_MS = 1000;

// storage keeps each channel and tab in its own key, plus a small index (dates only) for the LRU.
// Each write carries only what changed: storage.onChanged in every YouTube tab receives a few KB,
// not the whole cache (~1 MB).
export function createChannelTabCache({ storage, now = Date.now }) {
  // Entries already read in this tab (null = not in storage).
  const entries = new Map();
  const changed = new Set();
  const touched = new Set();
  let persistTimer = null;
  const keyOf = (channel, tab) => `${channel.ucid}:${tab}`;

  async function entryFor(key) {
    // Read on demand: another tab may have written this channel.
    if (!entries.has(key) || !entries.get(key)) entries.set(key, await storage.loadEntry(key).catch(() => null));
    return entries.get(key);
  }

  async function persist() {
    const keys = [...new Set([...changed, ...touched])].filter((key) => entries.get(key));
    const local = Object.fromEntries(keys.map((key) => [key, summaryOf(entries.get(key))]));
    const toSave = Object.fromEntries([...changed].filter((key) => entries.get(key)).map((key) => [key, entries.get(key)]));
    changed.clear();
    touched.clear();
    // Other tabs write to the same storage: merge the index before writing.
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
    // Groups several writes (a batch of channels) into a single storage write.
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

// Per key, the most recent fetch wins; the most recent use counts for the LRU.
export function mergeEntries(stored, local) {
  const merged = { ...stored };
  for (const [key, entry] of Object.entries(local)) {
    const other = merged[key];
    const newest = !other || entry.fetchedAt >= other.fetchedAt ? entry : other;
    merged[key] = { ...newest, usedAt: Math.max(entry.usedAt, other?.usedAt ?? 0) };
  }
  return merged;
}

// Removes the least recently used channels (with both tabs) from the index when it goes over the
// limit (LRU) and returns the removed keys.
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
