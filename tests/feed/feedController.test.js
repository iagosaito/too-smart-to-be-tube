import { describe, expect, it, vi } from 'vitest';
import { createFeedController, modelOf, PAGE_SIZE } from '../../src/feed/feedController.js';
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
  it('Shorts: opening the tab already loads the first batch (only that one)', async () => {
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

  it('Videos: opening the tab makes no requests; shows the already synced feed', async () => {
    const source = fakeSource();
    const controller = createFeedController({ source, onChange: () => {} });
    const session = controller.sessionFor(category, 'videos', [channel(1)], {});
    await flush();
    expect(source.load).not.toHaveBeenCalled();
    const feed = [{ videoId: 'f1', channelId: '/@c1', publishedAt: 5, title: 'x' }, { videoId: 'f2', channelId: '/@outro', publishedAt: 9, title: 'y' }];
    expect(modelOf(session, feed).items.map((video) => video.videoId)).toEqual(['f1']);
  });

  it('channels with a fresh cache show without a request and stay out of the batch', async () => {
    const source = fakeSource({ cached: { '/@c1': [{ videoId: 's1', channelId: '/@c1' }] } });
    const controller = createFeedController({ source, onChange: () => {}, batchSize: 1 });
    const session = controller.sessionFor(category, 'shorts', [channel(1), channel(2)], { '/@c1': 10 });
    await flush();
    await flush();
    expect(modelOf(session).items.map((item) => item.videoId)).toEqual(expect.arrayContaining(['s1']));
    expect(source.load.mock.calls.map(([item]) => item.id)).not.toContain('/@c1');
  });

  it("a channel's failure shows the reason and frees the channel for a retry", async () => {
    const source = fakeSource({ load: async () => { throw new LocalizedError('error.rateLimited'); } });
    const controller = createFeedController({ source, onChange: () => {}, batchSize: 1 });
    const session = controller.sessionFor(category, 'shorts', [channel(1)], {});
    await flush();
    expect(modelOf(session)).toMatchObject({ errorKey: 'error.rateLimited', hasMore: true, loading: 0 });
  });

  it('counts channels without a ucid (old sync) so the UI can guide the user', () => {
    const controller = createFeedController({ source: fakeSource(), onChange: () => {} });
    const session = controller.sessionFor(category, 'videos', [channel(1), channel(2, false)], {});
    expect(modelOf(session).missingIds).toBe(1);
  });

  it('the same category and tab reuse the session; changing the channels recreates it', () => {
    const controller = createFeedController({ source: fakeSource(), onChange: () => {} });
    const first = controller.sessionFor(category, 'videos', [channel(1)], {});
    expect(controller.sessionFor(category, 'videos', [channel(1)], {})).toBe(first);
    expect(controller.sessionFor(category, 'videos', [channel(1), channel(2)], {})).not.toBe(first);
  });
});

describe('feed pages', () => {
  const shortsOf = (item, count) => Array.from({ length: count }, (_, i) => ({ videoId: `${item.id}-s${i}`, channelId: item.id, title: 't' }));

  it('Shorts: the first batch yields several pages of 24 without any new request', async () => {
    const source = fakeSource({ load: async (item) => shortsOf(item, 48) });
    const controller = createFeedController({ source, onChange: () => {}, batchSize: 8 });
    const session = controller.sessionFor(category, 'shorts', Array.from({ length: 20 }, (_, n) => channel(n)), {});
    await flush();
    expect(source.load).toHaveBeenCalledTimes(8);
    expect(modelOf(session).items).toHaveLength(PAGE_SIZE);
    expect(modelOf(session).hasMore).toBe(true);

    controller.loadMore(session);
    await flush();
    expect(modelOf(session).items).toHaveLength(2 * PAGE_SIZE);
    expect(source.load).toHaveBeenCalledTimes(8);
  });

  it("Shorts: only queries the next batch when what was downloaded doesn't fill the page", async () => {
    const source = fakeSource({ load: async (item) => shortsOf(item, 5) });
    const controller = createFeedController({ source, onChange: () => {}, batchSize: 2 });
    const session = controller.sessionFor(category, 'shorts', Array.from({ length: 6 }, (_, n) => channel(n)), {});
    await flush();
    expect(modelOf(session).items).toHaveLength(10);
    controller.loadMore(session);
    await flush();
    expect(source.load).toHaveBeenCalledTimes(4);
    expect(modelOf(session).items).toHaveLength(20);
  });

  it('Shorts: if the cache already fills the first page, nothing goes to the network', async () => {
    const channels = Array.from({ length: 4 }, (_, n) => channel(n));
    const source = fakeSource({ cached: Object.fromEntries(channels.map((item) => [item.id, shortsOf(item, 10)])) });
    const controller = createFeedController({ source, onChange: () => {} });
    const session = controller.sessionFor(category, 'shorts', channels, {});
    await flush();
    expect(source.load).not.toHaveBeenCalled();
    expect(modelOf(session).items).toHaveLength(PAGE_SIZE);
  });

  it('Videos: pages through the already synced feed and only queries channels when it runs out', async () => {
    const channels = [channel(1), channel(2)];
    const feedItems = Array.from({ length: 30 }, (_, i) => ({ videoId: `v${i}`, channelId: channels[i % 2].id, publishedAt: 1_000 - i, title: 't' }));
    const source = fakeSource({ load: async () => [] });
    const controller = createFeedController({ source, onChange: () => {} });
    const session = controller.sessionFor(category, 'videos', channels, {});
    await flush();
    expect(modelOf(session, feedItems).items).toHaveLength(PAGE_SIZE);
    expect(source.load).not.toHaveBeenCalled();

    controller.loadMore(session, feedItems);
    await flush();
    expect(modelOf(session, feedItems).items).toHaveLength(30);
    expect(source.load).toHaveBeenCalledTimes(2);
  });
});

describe('createFeedSource', () => {
  const cacheStub = (hit = null) => ({ get: vi.fn(async () => hit), set: vi.fn(async () => {}) });

  it('uses the cache when there is one; otherwise queries through the queue and stores the result', async () => {
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

  // Regression: a new session (channel added to the category, page reopened) requested again
  // channels whose batch was still in flight.
  it('simultaneous requests for the same channel and tab share a single query', async () => {
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

  it("a failed query doesn't get stuck: the next request queries again", async () => {
    const fetchTab = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(['ok']);
    const source = createFeedSource({ cache: cacheStub(), queue: { run: (task) => task() }, clientVersion: () => '2.2026', fetchTab });
    await expect(source.load(channel(1), 'videos')).rejects.toThrow('rede');
    expect(await source.load(channel(1), 'videos')).toEqual(['ok']);
    expect(fetchTab).toHaveBeenCalledTimes(2);
  });

  it('without the client version in the page, fails with a translatable error instead of querying', async () => {
    const source = createFeedSource({ cache: cacheStub(), queue: { run: vi.fn() }, clientVersion: () => null });
    await expect(source.load(channel(1), 'videos')).rejects.toMatchObject({ key: 'error.feedUnavailable' });
  });
});
