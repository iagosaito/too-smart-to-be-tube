// Regressão: cada clique em "Categorias" criava uma página nova que não sabia
// da sincronização em andamento. Cliques repetidos disparavam sincronizações
// em paralelo, cada uma com até ~100 requisições autenticadas ao YouTube
// (risco de rate-limit) e gravações que se atropelavam.
import { expect, it, vi } from 'vitest';
import { ENTRY_ID } from '../../src/dom/sidebar.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { channelRenderer, channelsPageHtml, initialData } from '../helpers/innertubeFixtures.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it('cliques repetidos em Categorias compartilham uma única sincronização', async () => {
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
