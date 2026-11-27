// Loaded on a Categories URL before YouTube mounts its page manager: opening waits for it, and the
// user may leave during that wait.
import { beforeAll, expect, it, vi } from 'vitest';
import { PAGE_ID } from '../../src/ui/page.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeAll(async () => {
  window.history.replaceState(null, '', '/watch?v=w');
  window.history.pushState(null, '', '/feed/subscriptions#tstb=prog');
  document.body.innerHTML = GUIDE_HTML;
  window.scrollTo = vi.fn();
  const now = Date.now();
  const area = createFakeStorageArea({ channels: {}, categories: [{ id: 'prog', name: 'Programação', channelIds: [] }], lastSyncedAt: now, uploadsSyncedAt: now, feedSyncedAt: now });
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: area, onChanged: { addListener: () => {} } } };
  globalThis.fetch = vi.fn(async () => ({ ok: true, text: async () => '' }));
  await import('../../src/content/main.js');
  await flush();
});

it('quem sai antes de o YouTube montar a página não recebe a página de Categorias depois', async () => {
  window.history.back();
  await flush();
  document.body.prepend(document.createElement('ytd-page-manager'));
  await flush();
  expect(document.getElementById(PAGE_ID)).toBeNull();
  expect(window.location.pathname + window.location.search).toBe('/watch?v=w');
});
