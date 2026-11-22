import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TTL_MS, createChannelTabCache, MAX_CACHED_ENTRIES } from '../../src/feed/channelTabCache.js';

const channel = (n) => ({ id: `/@c${n}`, ucid: `UC${String(n).padStart(22, '0')}` });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createChannelTabCache', () => {
  it('devolve itens frescos e expira depois do TTL de cada aba', async () => {
    let now = 0;
    const cache = createChannelTabCache({ load: async () => ({}), save: async () => {}, now: () => now });
    await cache.set(channel(1), 'videos', [{ videoId: 'a' }]);
    await cache.set(channel(1), 'shorts', [{ videoId: 'b' }]);
    now = CACHE_TTL_MS.videos;
    expect(await cache.get(channel(1), 'videos')).toEqual([{ videoId: 'a' }]);
    now = CACHE_TTL_MS.videos + 1;
    expect(await cache.get(channel(1), 'videos')).toBeNull();
    expect(await cache.get(channel(1), 'shorts')).toEqual([{ videoId: 'b' }]);
  });

  it('carrega o que foi persistido e agrupa as gravações numa só', async () => {
    const save = vi.fn(async () => {});
    const cache = createChannelTabCache({ load: async () => ({ [`${channel(9).ucid}:videos`]: { fetchedAt: 0, usedAt: 0, items: [1] } }), save, now: () => 0 });
    expect(await cache.get(channel(9), 'videos')).toEqual([1]);
    await cache.set(channel(1), 'videos', []);
    await cache.set(channel(2), 'videos', []);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledOnce();
  });

  it('mantém no máximo o limite de entradas, descartando as usadas há mais tempo', async () => {
    let now = 0;
    const save = vi.fn(async () => {});
    const cache = createChannelTabCache({ load: async () => ({}), save, now: () => now });
    for (let n = 0; n <= MAX_CACHED_ENTRIES; n += 1) {
      now = n;
      await cache.set(channel(n), 'videos', []);
    }
    expect(await cache.get(channel(0), 'videos')).toBeNull();
    expect(await cache.get(channel(MAX_CACHED_ENTRIES), 'videos')).toEqual([]);
  });

  it('guarda no máximo 30 itens por canal', async () => {
    const cache = createChannelTabCache({ load: async () => ({}), save: async () => {}, now: () => 0 });
    await cache.set(channel(1), 'shorts', Array.from({ length: 48 }, (_, index) => index));
    expect(await cache.get(channel(1), 'shorts')).toHaveLength(30);
  });
});
