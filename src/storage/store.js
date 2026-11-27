import { mergeChannels } from '../core/channels.js';

const KEYS = ['channels', 'categories', 'lastSyncedAt', 'latestUploads', 'uploadsSyncedAt', 'preferences', 'feedItems', 'feedSyncedAt', 'feedAttemptedAt'];
// The newest videos from the subscriptions feed (~150 bytes each): enough for several weeks of
// per-category feed without weighing on storage.
export const MAX_FEED_ITEMS = 800;
// Channel tab cache: one key per channel and tab (tabCache:<ucid>:<tab>) and an index with only the
// dates.
const TAB_CACHE_PREFIX = 'tabCache:';
const TAB_CACHE_INDEX_KEY = 'tabCacheIndex';
// Pause and recent starts of the request queue, shared by every tab.
const REQUEST_BUDGET_KEY = 'requestBudget';

// storage.local instead of storage.sync: sync limits each item to 8 KB, which overflows quickly
// with hundreds of subscriptions. The area is injected so tests can use an in-memory fake.
export function createStore(area) {
  return {
    load: () => loadState(area),
    saveCategories: (categories) => area.set({ categories }),
    mergeChannels: (channels) => saveMergedChannels(area, channels),
    replaceChannels: (channels, now = Date.now()) => saveFullSync(area, channels, now),
    saveUploads: (uploads, now = Date.now()) => saveMergedUploads(area, uploads, now),
    savePreferences: (changes) => saveMergedPreferences(area, changes),
    saveFeed: (items, now = Date.now()) => area.set({ feedItems: items.slice(0, MAX_FEED_ITEMS), feedSyncedAt: now }),
    // Written on every attempt to read the feed, even on failure: otherwise a persistent failure
    // would make every page open sync again.
    markFeedAttempt: (now = Date.now()) => area.set({ feedAttemptedAt: now }),
    channelTabStorage: createChannelTabStorage(area),
    loadRequestBudget: async () => (await area.get([REQUEST_BUDGET_KEY]))[REQUEST_BUDGET_KEY] ?? null,
    saveRequestBudget: (budget) => area.set({ [REQUEST_BUDGET_KEY]: budget }),
  };
}

function createChannelTabStorage(area) {
  const storageKey = (key) => `${TAB_CACHE_PREFIX}${key}`;
  return {
    loadEntry: async (key) => (await area.get([storageKey(key)]))[storageKey(key)] ?? null,
    saveEntries: (entries) => {
      const items = Object.fromEntries(Object.entries(entries).map(([key, entry]) => [storageKey(key), entry]));
      return Object.keys(items).length ? area.set(items) : Promise.resolve();
    },
    removeEntries: (keys) => area.remove(keys.map(storageKey)),
    loadIndex: async () => (await area.get([TAB_CACHE_INDEX_KEY]))[TAB_CACHE_INDEX_KEY] ?? {},
    saveIndex: (index) => area.set({ [TAB_CACHE_INDEX_KEY]: index }),
  };
}

async function loadState(area) {
  const data = await area.get(KEYS);
  // On first run storage is empty; defaults avoid scattered checks.
  return {
    channels: data.channels ?? {},
    categories: data.categories ?? [],
    lastSyncedAt: data.lastSyncedAt ?? null,
    latestUploads: data.latestUploads ?? {},
    uploadsSyncedAt: data.uploadsSyncedAt ?? null,
    preferences: data.preferences ?? {},
    feedItems: data.feedItems ?? [],
    feedSyncedAt: data.feedSyncedAt ?? null,
    feedAttemptedAt: data.feedAttemptedAt ?? null,
  };
}

async function saveMergedChannels(area, incoming) {
  const { channels } = await loadState(area);
  const merged = mergeChannels(channels, incoming);
  await area.set({ channels: merged });
  return merged;
}

async function saveFullSync(area, channels, now) {
  // The full sync is the official list: replacing (instead of merging) makes cancelled
  // subscriptions disappear. Categories stay intact and grouping already ignores ids of channels
  // that no longer exist.
  await area.set({ channels: mergeChannels({}, channels), lastSyncedAt: now });
}

async function saveMergedUploads(area, incoming, now) {
  // Merges keeping the newest date: the feed only covers a few weeks, so a channel that dropped out
  // of it must not lose the date we already knew.
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
