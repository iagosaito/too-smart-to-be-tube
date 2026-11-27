// Regression (#8): the whole cache (up to ~150 channels × 30 items, close to 1 MB) sat in a single
// key, rewritten on every batch. Each write reaches storage.onChanged in every open YouTube tab
// with the old and the new value.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createChannelTabCache } from '../../src/feed/channelTabCache.js';
import { createStore } from '../../src/storage/store.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const channel = (n) => ({ id: `/@c${n}`, ucid: `UC${String(n).padStart(22, '0')}` });
const items = (n) => Array.from({ length: 30 }, (_, i) => ({ videoId: `v${n}-${i}`, title: 'x'.repeat(150), channelId: `/@c${n}`, viewCount: 1 }));
const bytes = (value) => JSON.stringify(value).length;

it("writing one channel doesn't rewrite the others' cache", async () => {
  const area = createFakeStorageArea();
  const cache = createChannelTabCache({ storage: createStore(area).channelTabStorage });
  for (let n = 0; n < 100; n += 1) await cache.set(channel(n), 'shorts', items(n));
  await vi.advanceTimersByTimeAsync(1000);

  const writes = [];
  const set = area.set;
  area.set = async (payload) => { writes.push(payload); return set(payload); };
  await cache.set(channel(100), 'shorts', items(100));
  await vi.advanceTimersByTimeAsync(1000);

  const written = writes.reduce((sum, payload) => sum + bytes(payload), 0);
  expect(bytes(area.dump())).toBeGreaterThan(500_000);
  expect(written).toBeLessThan(40_000);
});

it('another tab reads the channel this tab wrote', async () => {
  const area = createFakeStorageArea();
  const tabA = createChannelTabCache({ storage: createStore(area).channelTabStorage, now: () => 1 });
  const tabB = createChannelTabCache({ storage: createStore(area).channelTabStorage, now: () => 2 });
  await tabA.set(channel(1), 'videos', items(1));
  await vi.advanceTimersByTimeAsync(1000);
  expect(await tabB.get(channel(1), 'videos')).toEqual(items(1));
});
