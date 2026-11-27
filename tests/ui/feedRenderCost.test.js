// Regression: on the Videos and Shorts tabs, every render built the whole channel grid (cards,
// images, buttons) and threw it away, because the results are the feed. With 500 channels that was
// ~3 thousand elements per render, several times per batch.
import { afterEach, expect, it, vi } from 'vitest';
import { createFeedCardCache } from '../../src/ui/components/feedView.js';
import { renderPage } from '../../src/ui/render.js';

afterEach(() => vi.restoreAllMocks());

const actions = new Proxy({}, { get: (_, key) => (key === 'hasFeed' ? true : () => {}) });

function stateWith(count) {
  const ids = Array.from({ length: count }, (_, i) => `/@c${i}`);
  const channels = Object.fromEntries(ids.map((id, i) => [id, { id, name: `Canal ${i}`, url: `https://www.youtube.com${id}`, avatar: `https://yt3.example/${i}.jpg` }]));
  return { channels, categories: [{ id: 'dev', name: 'Programação', channelIds: ids }], lastSyncedAt: 1, latestUploads: {}, uploadsSyncedAt: 1, preferences: {}, feedItems: [], feedSyncedAt: 1 };
}

function elementsCreatedByFeedRender(count) {
  const state = stateWith(count);
  const view = { filter: 'dev', query: '', sort: null, selected: new Set(), tab: 'videos', pendingImport: null, syncing: false, syncError: '' };
  const model = { items: [], loading: 0, hasMore: false, missingIds: false, channelCount: count, errorKey: null };
  const feed = { tab: 'videos', model, channelsById: state.channels, now: 1, cache: createFeedCardCache(), query: '' };
  const spy = vi.spyOn(document, 'createElement');
  renderPage(state, view, actions, { now: 1, cardCache: undefined, feed });
  const created = spy.mock.calls.length;
  spy.mockRestore();
  return created;
}

it('na aba Vídeos, o custo do render não cresce com o número de canais da categoria', () => {
  expect(elementsCreatedByFeedRender(500)).toBe(elementsCreatedByFeedRender(1));
});
