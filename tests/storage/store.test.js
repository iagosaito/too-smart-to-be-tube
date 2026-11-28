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
    expect(await store.load()).toEqual({ channels: {}, categories: [], lastSyncedAt: null, latestUploads: {}, uploadsSyncedAt: null, preferences: {}, feedItems: [], feedSyncedAt: null, feedCheckedAt: null, listCheckedAt: null });
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

  it('mergeFeed merges onto what is stored when it writes, keeping a write from another tab', async () => {
    const area = createFakeStorageArea({ feedItems: [{ videoId: 'a', publishedAt: 10 }] });
    const store = createStore(area);
    const loadedEarlier = await store.load();
    // Another tab writes after this one loaded.
    await createStore(area).mergeFeed([{ videoId: 'b', publishedAt: 20 }], 5);
    await store.mergeFeed([{ videoId: 'c', publishedAt: 30 }], 6);
    const state = await store.load();
    expect(loadedEarlier.feedItems).toHaveLength(1);
    expect(state.feedItems.map((video) => video.videoId)).toEqual(['c', 'b', 'a']);
    expect(state.feedSyncedAt).toBe(6);
  });

  it("the feed refresh doesn't touch the subscriptions list date", async () => {
    const store = createStore(createFakeStorageArea({ lastSyncedAt: 1 }));
    await store.claimFeedRefresh(() => true, 9);
    await store.mergeFeed([{ videoId: 'a', publishedAt: 1 }], 9);
    expect((await store.load()).lastSyncedAt).toBe(1);
  });

  it('a claim records the attempt only when due, read from storage at that moment', async () => {
    const area = createFakeStorageArea();
    const store = createStore(area);
    const isDue = (state, now) => state.feedCheckedAt == null || now - state.feedCheckedAt >= 10;
    expect(await store.claimFeedRefresh(isDue, 100)).toBe(true);
    expect(await createStore(area).claimFeedRefresh(isDue, 105)).toBe(false);
    expect(await store.claimFeedRefresh(isDue, 110)).toBe(true);
    expect(await store.claimListSync(() => true, 120)).toBe(true);
    expect(area.dump()).toMatchObject({ feedCheckedAt: 110, listCheckedAt: 120 });
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
