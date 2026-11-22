import { mergeChannels } from '../core/channels.js';

const KEYS = ['channels', 'categories', 'lastSyncedAt', 'latestUploads', 'uploadsSyncedAt', 'preferences', 'feedItems', 'feedSyncedAt'];
// Os vídeos mais recentes do feed de Inscrições (~150 bytes cada): o bastante
// para várias semanas de feed por categoria sem pesar no storage.
export const MAX_FEED_ITEMS = 800;
const CHANNEL_TAB_CACHE_KEY = 'channelTabCache';

// storage.local em vez de storage.sync: o sync limita cada item a 8 KB, o que
// estoura rápido com centenas de inscrições.
// A área é injetada para que os testes usem um fake em memória.
export function createStore(area) {
  return {
    load: () => loadState(area),
    saveCategories: (categories) => area.set({ categories }),
    mergeChannels: (channels) => saveMergedChannels(area, channels),
    replaceChannels: (channels, now = Date.now()) => saveFullSync(area, channels, now),
    saveUploads: (uploads, now = Date.now()) => saveMergedUploads(area, uploads, now),
    savePreferences: (changes) => saveMergedPreferences(area, changes),
    saveFeed: (items, now = Date.now()) => area.set({ feedItems: items.slice(0, MAX_FEED_ITEMS), feedSyncedAt: now }),
    loadChannelTabCache: async () => (await area.get([CHANNEL_TAB_CACHE_KEY]))[CHANNEL_TAB_CACHE_KEY] ?? {},
    saveChannelTabCache: (cache) => area.set({ [CHANNEL_TAB_CACHE_KEY]: cache }),
  };
}

async function loadState(area) {
  const data = await area.get(KEYS);
  // Na primeira execução o storage está vazio; padrões evitam checagens espalhadas.
  return {
    channels: data.channels ?? {},
    categories: data.categories ?? [],
    lastSyncedAt: data.lastSyncedAt ?? null,
    latestUploads: data.latestUploads ?? {},
    uploadsSyncedAt: data.uploadsSyncedAt ?? null,
    preferences: data.preferences ?? {},
    feedItems: data.feedItems ?? [],
    feedSyncedAt: data.feedSyncedAt ?? null,
  };
}

async function saveMergedChannels(area, incoming) {
  const { channels } = await loadState(area);
  const merged = mergeChannels(channels, incoming);
  await area.set({ channels: merged });
  return merged;
}

async function saveFullSync(area, channels, now) {
  // A sincronização completa é a lista oficial: substituir (em vez de mesclar)
  // faz inscrições canceladas sumirem. As categorias ficam intactas e o
  // agrupamento já ignora ids de canais que não existem mais.
  await area.set({ channels: mergeChannels({}, channels), lastSyncedAt: now });
}

async function saveMergedUploads(area, incoming, now) {
  // Mescla mantendo a data mais nova: o feed só cobre algumas semanas, então
  // um canal que sumiu dele não deve perder a data que já conhecíamos.
  const { latestUploads } = await loadState(area);
  const merged = { ...latestUploads };
  for (const [channelId, publishedAt] of Object.entries(incoming)) {
    merged[channelId] = Math.max(merged[channelId] ?? 0, publishedAt);
  }
  await area.set({ latestUploads: merged, uploadsSyncedAt: now });
}

async function saveMergedPreferences(area, changes) {
  const { preferences } = await loadState(area);
  await area.set({ preferences: { ...preferences, ...changes } });
}
