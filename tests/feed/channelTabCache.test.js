import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TTL_MS, createChannelTabCache, MAX_CACHED_CHANNELS } from '../../src/feed/channelTabCache.js';
import { createStore } from '../../src/storage/store.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';

const channel = (n) => ({ id: `/@c${n}`, ucid: `UC${String(n).padStart(22, '0')}` });
const cacheOn = (area, now) => createChannelTabCache({ storage: createStore(area).channelTabStorage, now });
const storedKeys = (area) => Object.keys(area.dump()).filter((key) => key.startsWith('tabCache:')).sort();
// Writes whatever is pending (writes are grouped within 1 s).
const persist = () => vi.advanceTimersByTimeAsync(1000);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createChannelTabCache', () => {
  it("returns fresh items and expires them after each tab's TTL", async () => {
    let now = 0;
    const cache = cacheOn(createFakeStorageArea(), () => now);
    await cache.set(channel(1), 'videos', [{ videoId: 'a' }]);
    await cache.set(channel(1), 'shorts', [{ videoId: 'b' }]);
    now = CACHE_TTL_MS.videos;
    expect(await cache.get(channel(1), 'videos')).toEqual([{ videoId: 'a' }]);
    now = CACHE_TTL_MS.videos + 1;
    expect(await cache.get(channel(1), 'videos')).toBeNull();
    expect(await cache.get(channel(1), 'shorts')).toEqual([{ videoId: 'b' }]);
  });

  it("reads what was persisted and groups a batch's writes into one", async () => {
    const area = createFakeStorageArea({ [`tabCache:${channel(9).ucid}:videos`]: { fetchedAt: 0, usedAt: 0, items: [1] } });
    const cache = cacheOn(area, () => 0);
    expect(await cache.get(channel(9), 'videos')).toEqual([1]);
    const set = vi.spyOn(area, 'set');
    await cache.set(channel(1), 'videos', []);
    await cache.set(channel(2), 'videos', []);
    await persist();
    // One write with the new entries and another with the index.
    expect(set).toHaveBeenCalledTimes(2);
    expect(storedKeys(area)).toEqual([`tabCache:${channel(1).ucid}:videos`, `tabCache:${channel(2).ucid}:videos`, `tabCache:${channel(9).ucid}:videos`]);
  });

  // Regression (#6): the limit was 150 entries and each channel takes two (Videos and Shorts): a
  // 100-channel category already lost part of its cache.
  it(`keeps ${MAX_CACHED_CHANNELS} channels with both tabs`, async () => {
    let now = 0;
    const cache = cacheOn(createFakeStorageArea(), () => now);
    for (let n = 0; n < MAX_CACHED_CHANNELS; n += 1) {
      now = n;
      await cache.set(channel(n), 'videos', []);
      await cache.set(channel(n), 'shorts', []);
    }
    await persist();
    expect(await cache.get(channel(0), 'videos')).toEqual([]);
    expect(await cache.get(channel(0), 'shorts')).toEqual([]);
  });

  it('over the limit, evicts the least recently used channel, with both tabs', async () => {
    let now = 0;
    const area = createFakeStorageArea();
    const cache = cacheOn(area, () => now);
    for (let n = 0; n <= MAX_CACHED_CHANNELS; n += 1) {
      now = n;
      await cache.set(channel(n), 'videos', []);
      await cache.set(channel(n), 'shorts', []);
    }
    await persist();
    expect(await cache.get(channel(0), 'videos')).toBeNull();
    expect(await cache.get(channel(0), 'shorts')).toBeNull();
    expect(await cache.get(channel(1), 'videos')).toEqual([]);
    expect(storedKeys(area)).toHaveLength(2 * MAX_CACHED_CHANNELS);
  });

  // Regression (#5): each tab loaded the cache once and wrote the whole object; the last one to
  // write erased what the others had saved.
  it("two tabs writing to the same storage don't erase what the other saved", async () => {
    const area = createFakeStorageArea();
    const tabA = cacheOn(area, () => 1);
    const tabB = cacheOn(area, () => 2);
    await tabA.get(channel(1), 'videos');
    await tabB.get(channel(1), 'videos');
    await tabA.set(channel(1), 'videos', ['a']);
    await tabB.set(channel(2), 'videos', ['b']);
    await persist();
    expect(storedKeys(area)).toEqual([`tabCache:${channel(1).ucid}:videos`, `tabCache:${channel(2).ucid}:videos`]);
    expect(Object.keys(area.dump().tabCacheIndex).sort()).toEqual([`${channel(1).ucid}:videos`, `${channel(2).ucid}:videos`]);
  });

  it('keeps at most 30 items per channel', async () => {
    const cache = cacheOn(createFakeStorageArea(), () => 0);
    await cache.set(channel(1), 'shorts', Array.from({ length: 48 }, (_, index) => index));
    expect(await cache.get(channel(1), 'shorts')).toHaveLength(30);
  });
});
