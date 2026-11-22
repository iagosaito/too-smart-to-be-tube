// Fluxo completo do feed por categoria, carregando o content script como o
// Chrome faz: sincronização guarda o feed e os ucids; o menu lateral abre a
// categoria direto no feed.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { PAGE_ID } from '../../src/ui/page.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { channelsPageHtml, initialData } from '../helpers/innertubeFixtures.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

// Resposta real do feed (lockups com autor), embrulhada como a página /feed/subscriptions.
const realFeed = JSON.parse(readFileSync('tests/fixtures/youtube/feed-lockups.json', 'utf8'));
const FIRESHIP_UCID = 'UCsBjURrPoezykLs9EqgamOA';
const channelRenderer = {
  channelRenderer: {
    channelId: FIRESHIP_UCID,
    title: { simpleText: 'Fireship' },
    thumbnail: { thumbnails: [{ url: '//yt3.example/fireship.jpg' }] },
    navigationEndpoint: { browseEndpoint: { canonicalBaseUrl: '/@Fireship' } },
  },
};

it('sincroniza o feed e o ucid; clicar na categoria do menu abre o feed dela', async () => {
  document.body.innerHTML = `<ytd-page-manager></ytd-page-manager>${GUIDE_HTML}`;
  window.scrollTo = vi.fn();
  const area = createFakeStorageArea({ categories: [{ id: 'dev', name: 'Programação', channelIds: ['/@Fireship'] }] });
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: area, onChanged: { addListener: () => {} } } };
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    text: async () => (String(url).includes('/feed/channels') ? channelsPageHtml(initialData([channelRenderer])) : channelsPageHtml({ contents: realFeed.items })),
  }));
  await import('../../src/content/main.js');
  await flush();

  const category = [...document.querySelectorAll('.tstb-sidebar-category')].find((node) => node.textContent === 'Programação');
  category.click();
  await flush();

  const stored = area.dump();
  expect(stored.channels['/@Fireship'].ucid).toBe(FIRESHIP_UCID);
  expect(stored.feedItems.map((video) => video.videoId)).toEqual(['rMaMe32qQkA', 'Qxor6jpfSiU']);
  expect(stored.feedSyncedAt).toEqual(expect.any(Number));

  const page = document.getElementById(PAGE_ID);
  expect(page.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Vídeos');
  expect([...page.querySelectorAll('.tstb-video-title')].map((node) => node.textContent)).toEqual([
    'If you’ve deployed anything since 2015, I have bad news...',
    'The only software that didn’t break this week...',
  ]);
  // O menu é redesenhado ao marcar a ativa; busca o item de novo em vez de usar a referência antiga.
  expect(document.querySelector('.tstb-sidebar-category-active').textContent).toBe('Programação');
});
