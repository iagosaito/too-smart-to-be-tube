// Races between opening the Categories page from its URL and the user (or YouTube) leaving it.
// Opening waits on storage (reading the DOM, loading the state); these tests hold storage at that
// point and navigate in the meantime.
import { beforeAll, expect, it, vi } from 'vitest';
import { PAGE_ID } from '../../src/ui/page.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};
const page = () => document.getElementById(PAGE_ID);
const path = () => window.location.pathname + window.location.search + window.location.hash;

// Storage calls wait while `holding` says so, until release() lets them all through.
let holding = () => false;
const held = [];
const gate = () => (holding() ? new Promise((resolve) => held.push(resolve)) : Promise.resolve());
const release = () => {
  holding = () => false;
  held.splice(0).forEach((resolve) => resolve());
};

beforeAll(async () => {
  window.history.replaceState(null, '', '/watch?v=w');
  window.history.pushState(null, '', '/feed/subscriptions#tstb=prog');
  document.body.innerHTML = `<ytd-page-manager></ytd-page-manager>${GUIDE_HTML}`;
  window.scrollTo = vi.fn();
  const now = Date.now();
  const area = createFakeStorageArea({
    channels: {}, categories: [{ id: 'prog', name: 'Programação', channelIds: [] }],
    lastSyncedAt: now, uploadsSyncedAt: now, feedSyncedAt: now, feedItems: [],
  });
  const local = {
    get: async (keys) => { await gate(); return area.get(keys); },
    set: async (items) => { await gate(); return area.set(items); },
    remove: (keys) => area.remove(keys),
  };
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local, onChanged: { addListener: () => {} } } };
  globalThis.fetch = vi.fn(async () => ({ ok: true, text: async () => '' }));
  // Loaded on the Categories URL, with storage held before the page is mounted.
  holding = () => true;
  await import('../../src/content/main.js');
  await flush();
});

it('voltar enquanto a página ainda está abrindo pela URL não a abre nem cria entrada no histórico', async () => {
  const length = window.history.length;
  window.history.back();
  await flush();
  expect(path()).toBe('/watch?v=w');

  release();
  await flush();
  expect(page()).toBeNull();
  expect(path()).toBe('/watch?v=w');
  expect(window.history.length).toBe(length);
});

it('se o YouTube fecha a página enquanto ela abre, a navegação dele reabre a categoria', async () => {
  // Held only once the page is mounted: the state is loading when YouTube navigates.
  holding = () => Boolean(page());
  window.history.forward();
  await flush();
  expect(page()).not.toBeNull();

  document.dispatchEvent(new Event('yt-navigate-start'));
  document.dispatchEvent(new Event('yt-navigate-finish'));
  await flush();
  release();
  await flush();
  expect(path()).toBe('/feed/subscriptions#tstb=prog');
  expect(page()).not.toBeNull();
});
