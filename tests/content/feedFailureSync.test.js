// Regressão: quando o feed de Inscrições falhava (layout novo, erro HTTP), as
// datas de sincronização do feed nunca eram gravadas. Toda abertura de
// Categorias depois do intervalo de 1 minuto refazia a sincronização inteira
// (até ~117 requisições autenticadas), e cada clique numa categoria do menu
// também abre a página.
import { afterEach, expect, it, vi } from 'vitest';
import { ENTRY_ID } from '../../src/dom/sidebar.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { channelRenderer, channelsPageHtml, initialData } from '../helpers/innertubeFixtures.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => vi.useRealTimers());

it('com o feed de Inscrições falhando, reabrir Categorias não refaz a sincronização completa', async () => {
  // Só o relógio é falso: os setTimeout de flush continuam reais.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(1_000_000_000_000);
  document.body.innerHTML = `<ytd-page-manager></ytd-page-manager>${GUIDE_HTML}`;
  window.scrollTo = vi.fn();
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: createFakeStorageArea(), onChanged: { addListener: () => {} } } };
  const channelsHtml = channelsPageHtml(initialData([channelRenderer('alura', 'Alura')]));
  globalThis.fetch = vi.fn(async (url) =>
    String(url).includes('/feed/channels') ? { ok: true, text: async () => channelsHtml } : { ok: false, status: 500, text: async () => '' },
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await import('../../src/content/main.js');
  await flush();

  const open = async () => {
    document.querySelector(`#${ENTRY_ID} button`).click();
    await flush();
  };
  await open();
  // Passa o intervalo de 1 minuto entre sincronizações e abre de novo.
  vi.setSystemTime(Date.now() + 61_000);
  await open();

  const channelListRequests = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/feed/channels'));
  expect(channelListRequests).toHaveLength(1);
});
