import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TTL_MS, createChannelTabCache, MAX_CACHED_CHANNELS } from '../../src/feed/channelTabCache.js';

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

  // Regressão (#6): o limite era de 150 entradas e cada canal ocupa duas
  // (Vídeos e Shorts): uma categoria de 100 canais já perdia parte do cache.
  it(`guarda ${MAX_CACHED_CHANNELS} canais com as duas abas`, async () => {
    let now = 0;
    const cache = createChannelTabCache({ load: async () => ({}), save: async () => {}, now: () => now });
    for (let n = 0; n < MAX_CACHED_CHANNELS; n += 1) {
      now = n;
      await cache.set(channel(n), 'videos', []);
      await cache.set(channel(n), 'shorts', []);
    }
    expect(await cache.get(channel(0), 'videos')).toEqual([]);
    expect(await cache.get(channel(0), 'shorts')).toEqual([]);
  });

  it('acima do limite descarta o canal usado há mais tempo, com as duas abas', async () => {
    let now = 0;
    const cache = createChannelTabCache({ load: async () => ({}), save: async () => {}, now: () => now });
    for (let n = 0; n <= MAX_CACHED_CHANNELS; n += 1) {
      now = n;
      await cache.set(channel(n), 'videos', []);
      await cache.set(channel(n), 'shorts', []);
    }
    expect(await cache.get(channel(0), 'videos')).toBeNull();
    expect(await cache.get(channel(0), 'shorts')).toBeNull();
    expect(await cache.get(channel(1), 'videos')).toEqual([]);
  });

  // Regressão (#5): cada aba carregava o cache uma vez e gravava o objeto
  // inteiro; a última a gravar apagava o que as outras tinham salvo.
  it('duas abas gravando no mesmo storage não apagam o que a outra salvou', async () => {
    const storage = {};
    const area = { load: async () => structuredClone(storage.cache ?? {}), save: async (cache) => { storage.cache = structuredClone(cache); } };
    const tabA = createChannelTabCache({ ...area, now: () => 1 });
    const tabB = createChannelTabCache({ ...area, now: () => 2 });
    await tabA.get(channel(1), 'videos');
    await tabB.get(channel(1), 'videos');
    await tabA.set(channel(1), 'videos', ['a']);
    await tabB.set(channel(2), 'videos', ['b']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(Object.keys(storage.cache).sort()).toEqual([`${channel(1).ucid}:videos`, `${channel(2).ucid}:videos`]);
  });

  it('guarda no máximo 30 itens por canal', async () => {
    const cache = createChannelTabCache({ load: async () => ({}), save: async () => {}, now: () => 0 });
    await cache.set(channel(1), 'shorts', Array.from({ length: 48 }, (_, index) => index));
    expect(await cache.get(channel(1), 'shorts')).toHaveLength(30);
  });
});
