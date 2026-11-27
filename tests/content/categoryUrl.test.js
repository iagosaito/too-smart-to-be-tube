// The content script loaded on a Categories URL, as after a refresh or from a bookmark, and then
// following Back/Forward.
import { beforeAll, expect, it, vi } from 'vitest';
import { PAGE_ID } from '../../src/ui/page.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};
const page = () => document.getElementById(PAGE_ID);
const selectedTab = () => page()?.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
const go = async (url) => {
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await flush();
};
const traverse = async (delta) => {
  window.history.go(delta);
  await flush();
};

beforeAll(async () => {
  // A YouTube page first, so Back has somewhere to go.
  window.history.replaceState(null, '', '/watch?v=abc');
  window.history.pushState(null, '', '/feed/subscriptions#tstb=prog&tab=channels');
  document.body.innerHTML = `<ytd-page-manager></ytd-page-manager>${GUIDE_HTML}`;
  window.scrollTo = vi.fn();
  // A recent sync: opening must not start one.
  const now = Date.now();
  const area = createFakeStorageArea({
    channels: { '/@alura': { id: '/@alura', name: 'Alura', url: 'https://www.youtube.com/@alura', avatar: '' } },
    categories: [{ id: 'prog', name: 'Programação', channelIds: ['/@alura'] }],
    lastSyncedAt: now, uploadsSyncedAt: now, feedSyncedAt: now, feedItems: [],
  });
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: area, onChanged: { addListener: () => {} } } };
  globalThis.fetch = vi.fn(async () => ({ ok: true, text: async () => '' }));
  await import('../../src/content/main.js');
  await flush();
});

it('carregar uma URL de Categorias abre a categoria e a aba que ela indica', () => {
  expect(page()).not.toBeNull();
  expect(selectedTab()).toBe('Canais');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it('voltar para a página do YouTube anterior fecha a página de Categorias', async () => {
  await traverse(-1);
  expect(window.location.pathname + window.location.search).toBe('/watch?v=abc');
  expect(page()).toBeNull();
});

it('avançar de novo para a URL de Categorias reabre a mesma visão', async () => {
  await traverse(1);
  expect(selectedTab()).toBe('Canais');
  expect(window.location.hash).toBe('#tstb=prog&tab=channels');
});

it('a navegação do YouTube e o popstate juntos abrem a página uma vez só', async () => {
  await go('/watch?v=abc');
  const mounts = [];
  const observer = new MutationObserver((records) => records.forEach((record) => mounts.push(...[...record.addedNodes].filter((node) => node.id === PAGE_ID))));
  observer.observe(document.querySelector('ytd-page-manager'), { childList: true });
  window.history.pushState(null, '', '/feed/subscriptions#tstb=prog');
  window.dispatchEvent(new PopStateEvent('popstate'));
  document.dispatchEvent(new Event('yt-navigate-finish'));
  await flush();
  observer.disconnect();
  expect(mounts).toHaveLength(1);
});
