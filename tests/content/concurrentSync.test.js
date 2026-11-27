// Regression: every click on "Categories" created a new page that didn't know about the sync in
// progress. Repeated clicks started syncs in parallel, each with up to ~100 authenticated requests
// to YouTube (rate-limit risk) and writes trampling each other.
import { expect, it, vi } from 'vitest';
import { ENTRY_ID } from '../../src/dom/sidebar.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { channelRenderer, channelsPageHtml, initialData } from '../helpers/innertubeFixtures.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it('repeated clicks on Categories share a single sync', async () => {
  document.body.innerHTML = `<ytd-page-manager></ytd-page-manager>${GUIDE_HTML}`;
  window.scrollTo = vi.fn();
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: createFakeStorageArea(), onChanged: { addListener: () => {} } } };
  const channelsHtml = channelsPageHtml(initialData([channelRenderer('alura', 'Alura')]));
  globalThis.fetch = vi.fn(async (url) => ({ ok: true, text: async () => (String(url).includes('/feed/channels') ? channelsHtml : channelsPageHtml({})) }));
  await import('../../src/content/main.js');
  await flush();

  const button = document.querySelector(`#${ENTRY_ID} button`);
  button.click();
  button.click();
  button.click();
  for (let i = 0; i < 10; i += 1) await flush();

  const channelListRequests = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/feed/channels'));
  expect(channelListRequests).toHaveLength(1);
});
