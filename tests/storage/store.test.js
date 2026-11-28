import { describe, expect, it } from 'vitest';
import { createStore } from '../../src/storage/store.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';

describe('request queue limits', () => {
  it('stores and reads the pause and the recent starts, shared by every tab', async () => {
    const store = createStore(createFakeStorageArea());
    expect(await store.loadRequestBudget()).toBeNull();
    await store.saveRequestBudget({ pausedUntil: 5, starts: [{ at: 1, id: 'a:1' }] });
    expect(await store.loadRequestBudget()).toEqual({ pausedUntil: 5, starts: [{ at: 1, id: 'a:1' }] });
  });
});

describe('createStore', () => {
  it('returns the default state when storage is empty', async () => {
    const store = createStore(createFakeStorageArea());
    expect(await store.load()).toEqual({ channels: {}, categories: [], lastSyncedAt: null, latestUploads: {}, uploadsSyncedAt: null, preferences: {}, feedItems: [], feedSyncedAt: null });
  });

  it('saves and reloads categories', async () => {
    const store = createStore(createFakeStorageArea());
    const categories = [{ id: '1', name: 'Tech', channelIds: [] }];
    await store.saveCategories(categories);
    expect((await store.load()).categories).toEqual(categories);
  });

  it('merges new channels with the saved ones', async () => {
    const area = createFakeStorageArea({ channels: { '/@a': { id: '/@a', name: 'A', url: 'a', avatar: 'a.jpg' } } });
    const store = createStore(area);
    await store.mergeChannels([{ id: '/@b', name: 'B', url: 'b', avatar: '' }]);
    expect(Object.keys(area.dump().channels)).toEqual(['/@a', '/@b']);
  });

  it("doesn't erase categories when merging channels", async () => {
    const categories = [{ id: '1', name: 'Tech', channelIds: ['/@a'] }];
    const store = createStore(createFakeStorageArea({ categories }));
    await store.mergeChannels([{ id: '/@a', name: 'A', url: 'a', avatar: '' }]);
    expect((await store.load()).categories).toEqual(categories);
  });

  it('replaceChannels replaces the whole list and records the date', async () => {
    const area = createFakeStorageArea({ channels: { '/@velho': { id: '/@velho', name: 'Velho', url: 'v', avatar: '' } } });
    const store = createStore(area);
    await store.replaceChannels([{ id: '/@novo', name: 'Novo', url: 'n', avatar: '' }], 123);
    const state = await store.load();
    expect(Object.keys(state.channels)).toEqual(['/@novo']);
    expect(state.lastSyncedAt).toBe(123);
  });

  it('saveUploads keeps the newest date per channel and records when it synced', async () => {
    const store = createStore(createFakeStorageArea({ latestUploads: { '/@a': 50, '/@b': 10 } }));
    await store.saveUploads({ '/@a': 20, '/@b': 40, '/@c': 30 }, 999);
    const state = await store.load();
    expect(state.latestUploads).toEqual({ '/@a': 50, '/@b': 40, '/@c': 30 });
    expect(state.uploadsSyncedAt).toBe(999);
  });

  it('savePreferences merges with the existing preferences', async () => {
    const store = createStore(createFakeStorageArea({ preferences: { outra: true } }));
    await store.savePreferences({ sortBy: 'recent' });
    expect((await store.load()).preferences).toEqual({ outra: true, sortBy: 'recent' });
  });

  it('saveFeed keeps only the newest videos up to the limit and records the date', async () => {
    const store = createStore(createFakeStorageArea());
    const items = Array.from({ length: 900 }, (_, index) => ({ videoId: `v${index}` }));
    await store.saveFeed(items, 77);
    const state = await store.load();
    expect(state.feedItems).toHaveLength(800);
    expect(state.feedItems[0].videoId).toBe('v0');
    expect(state.feedSyncedAt).toBe(77);
  });

  it('stores the channel tab cache in one key per channel and tab, plus an index', async () => {
    const area = createFakeStorageArea();
    const { channelTabStorage: storage } = createStore(area);
    expect(await storage.loadEntry('UCx:videos')).toBeNull();
    await storage.saveEntries({ 'UCx:videos': { fetchedAt: 1, usedAt: 1, items: [] } });
    await storage.saveIndex({ 'UCx:videos': { fetchedAt: 1, usedAt: 1 } });
    expect(await storage.loadEntry('UCx:videos')).toEqual({ fetchedAt: 1, usedAt: 1, items: [] });
    expect(await storage.loadIndex()).toEqual({ 'UCx:videos': { fetchedAt: 1, usedAt: 1 } });
    await storage.removeEntries(['UCx:videos']);
    expect(await storage.loadEntry('UCx:videos')).toBeNull();
    expect(Object.keys(area.dump())).toEqual(['tabCacheIndex']);
  });
});
