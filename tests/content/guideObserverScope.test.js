// Regression: in a narrow window the expanded menu only gets its sections when the user opens ☰
// (checked on youtube.com: tp-yt-app-drawer#guide exists empty from page load). The wait for the
// menu used a MutationObserver on the whole document, with no deadline, running on every page
// mutation, including during video playback.
import { afterEach, expect, it, vi } from 'vitest';
import { ENTRY_ID } from '../../src/dom/sidebar.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => vi.restoreAllMocks());

it('espera o menu expandido observando só o contêiner dele, não o documento', async () => {
  // Like narrow YouTube: the collapsed menu is ready, the expanded menu's drawer is empty.
  document.body.innerHTML = `
    <ytd-mini-guide-renderer><div id="items"></div></ytd-mini-guide-renderer>
    <tp-yt-app-drawer id="guide"><div id="guide-content"></div></tp-yt-app-drawer>
    <ytd-page-manager></ytd-page-manager>`;
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: createFakeStorageArea(), onChanged: { addListener: () => {} } } };
  globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }));
  const observed = [];
  const original = MutationObserver.prototype.observe;
  vi.spyOn(MutationObserver.prototype, 'observe').mockImplementation(function (target, options) {
    observed.push({ target, subtree: Boolean(options?.subtree) });
    return original.call(this, target, options);
  });
  await import('../../src/content/main.js');
  await flush();

  const wholeDocument = observed.filter(({ target, subtree }) => subtree && (target === document.documentElement || target === document.body || target === document));
  expect(wholeDocument).toEqual([]);

  // Opening ☰: YouTube creates the menu inside the drawer and the item goes into it.
  document.querySelector('#guide-content').insertAdjacentHTML('beforeend', GUIDE_HTML);
  await flush();
  expect(document.querySelector(`ytd-guide-renderer #${ENTRY_ID}`)).not.toBeNull();
});
