import { describe, expect, it, vi } from 'vitest';
import { createFeedController, modelOf } from '../../src/feed/feedController.js';
import { createFeedSource } from '../../src/feed/feedSource.js';
import { LocalizedError } from '../../src/i18n/errors.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const channel = (n, ucid = true) => ({ id: `/@c${n}`, name: `c${n}`, ...(ucid ? { ucid: `UC${String(n).padStart(22, '0')}` } : {}) });
const category = { id: 'cat', name: 'Cat' };

function fakeSource({ cached = {}, load } = {}) {
  return {
    cached: vi.fn(async (item) => cached[item.id] ?? null),
    load: vi.fn(load ?? (async (item, tab) => [{ videoId: `${item.id}-${tab}`, channelId: item.id, publishedAt: 1, title: 't' }])),
  };
}

describe('createFeedController', () => {
  it('Shorts: abrir a aba já carrega o primeiro lote (só ele)', async () => {
    const source = fakeSource();
    const controller = createFeedController({ source, onChange: () => {}, batchSize: 2 });
    const channels = [1, 2, 3, 4].map((n) => channel(n));
    const session = controller.sessionFor(category, 'shorts', channels, {});
    await flush();
    expect(source.load).toHaveBeenCalledTimes(2);
    expect(modelOf(session)).toMatchObject({ loading: 0, hasMore: true });
    controller.loadMore(session);
    await flush();
    expect(source.load).toHaveBeenCalledTimes(4);
    expect(modelOf(session).hasMore).toBe(false);
  });

  it('Vídeos: abrir a aba não faz requisições; mostra o feed já sincronizado', async () => {
    const source = fakeSource();
    const controller = createFeedController({ source, onChange: () => {} });
    const session = controller.sessionFor(category, 'videos', [channel(1)], {});
    await flush();
    expect(source.load).not.toHaveBeenCalled();
    const feed = [{ videoId: 'f1', channelId: '/@c1', publishedAt: 5, title: 'x' }, { videoId: 'f2', channelId: '/@outro', publishedAt: 9, title: 'y' }];
    expect(modelOf(session, feed).items.map((video) => video.videoId)).toEqual(['f1']);
  });

  it('canais com cache fresco aparecem sem requisição e não entram no lote', async () => {
    const source = fakeSource({ cached: { '/@c1': [{ videoId: 's1', channelId: '/@c1' }] } });
    const controller = createFeedController({ source, onChange: () => {}, batchSize: 1 });
    const session = controller.sessionFor(category, 'shorts', [channel(1), channel(2)], { '/@c1': 10 });
    await flush();
    await flush();
    expect(modelOf(session).items.map((item) => item.videoId)).toEqual(expect.arrayContaining(['s1']));
    expect(source.load.mock.calls.map(([item]) => item.id)).not.toContain('/@c1');
  });

  it('falha de um canal mostra o motivo e libera o canal para nova tentativa', async () => {
    const source = fakeSource({ load: async () => { throw new LocalizedError('error.rateLimited'); } });
    const controller = createFeedController({ source, onChange: () => {}, batchSize: 1 });
    const session = controller.sessionFor(category, 'shorts', [channel(1)], {});
    await flush();
    expect(modelOf(session)).toMatchObject({ errorKey: 'error.rateLimited', hasMore: true, loading: 0 });
  });

  it('conta canais sem ucid (sincronização antiga) para a interface orientar', () => {
    const controller = createFeedController({ source: fakeSource(), onChange: () => {} });
    const session = controller.sessionFor(category, 'videos', [channel(1), channel(2, false)], {});
    expect(modelOf(session).missingIds).toBe(1);
  });

  it('a mesma categoria e aba reaproveitam a sessão; mudar os canais recria', () => {
    const controller = createFeedController({ source: fakeSource(), onChange: () => {} });
    const first = controller.sessionFor(category, 'videos', [channel(1)], {});
    expect(controller.sessionFor(category, 'videos', [channel(1)], {})).toBe(first);
    expect(controller.sessionFor(category, 'videos', [channel(1), channel(2)], {})).not.toBe(first);
  });
});

describe('createFeedSource', () => {
  const cacheStub = (hit = null) => ({ get: vi.fn(async () => hit), set: vi.fn(async () => {}) });

  it('usa o cache quando há; senão consulta pela fila e guarda o resultado', async () => {
    const queue = { run: vi.fn((task) => task()) };
    const fetchTab = vi.fn(async () => ['novo']);
    const cache = cacheStub();
    const source = createFeedSource({ cache, queue, clientVersion: () => '2.2026', fetchTab });
    expect(await source.load(channel(1), 'videos')).toEqual(['novo']);
    expect(fetchTab).toHaveBeenCalledWith({ channel: channel(1), tab: 'videos', clientVersion: '2.2026' });
    expect(cache.set).toHaveBeenCalledWith(channel(1), 'videos', ['novo']);

    const cachedSource = createFeedSource({ cache: cacheStub(['velho']), queue, clientVersion: () => '2.2026', fetchTab });
    expect(await cachedSource.load(channel(1), 'videos')).toEqual(['velho']);
    expect(fetchTab).toHaveBeenCalledOnce();
  });

  // Regressão: uma sessão nova (canal adicionado à categoria, página reaberta)
  // pedia de novo canais cujo lote ainda estava em andamento.
  it('pedidos simultâneos do mesmo canal e aba compartilham uma única consulta', async () => {
    const release = {};
    const fetchTab = vi.fn(({ tab }) => new Promise((resolve) => { release[tab] = resolve; }));
    const source = createFeedSource({ cache: cacheStub(), queue: { run: (task) => task() }, clientVersion: () => '2.2026', fetchTab });
    const first = source.load(channel(1), 'videos');
    const second = source.load(channel(1), 'videos');
    const otherTab = source.load(channel(1), 'shorts');
    await flush();
    expect(fetchTab).toHaveBeenCalledTimes(2);
    release.videos(['ok']);
    release.shorts(['short']);
    expect(await second).toBe(await first);
    expect(await otherTab).toEqual(['short']);
  });

  it('uma consulta que falhou não fica presa: o próximo pedido consulta de novo', async () => {
    const fetchTab = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(['ok']);
    const source = createFeedSource({ cache: cacheStub(), queue: { run: (task) => task() }, clientVersion: () => '2.2026', fetchTab });
    await expect(source.load(channel(1), 'videos')).rejects.toThrow('rede');
    expect(await source.load(channel(1), 'videos')).toEqual(['ok']);
    expect(fetchTab).toHaveBeenCalledTimes(2);
  });

  it('sem a versão do cliente na página, falha com erro traduzível em vez de consultar', async () => {
    const source = createFeedSource({ cache: cacheStub(), queue: { run: vi.fn() }, clientVersion: () => null });
    await expect(source.load(channel(1), 'videos')).rejects.toMatchObject({ key: 'error.feedUnavailable' });
  });
});
