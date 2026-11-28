// The automatic refresh, counted in requests: the feed only as deep as the stored videos, the
// subscriptions list once a day or when the feed shows a new channel, and a 429 pausing everything.
import { afterAll, expect, it, vi } from 'vitest';
import { ENTRY_ID } from '../../src/dom/sidebar.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { channelRenderer, channelsPageHtml, initialData } from '../helpers/innertubeFixtures.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const MINUTE = 60_000;
const flush = async () => {
  for (let i = 0; i < 15; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const video = (videoId, handle) => ({
  videoRenderer: {
    videoId,
    title: { runs: [{ text: videoId }] },
    ownerText: { runs: [{ text: handle, navigationEndpoint: { browseEndpoint: { canonicalBaseUrl: `/@${handle}` } } }] },
    publishedTimeText: { simpleText: '1 hour ago' },
  },
});

const area = createFakeStorageArea();
let feedVideos = [video('aaaaaaaaaaa', 'alura')];
let feedStatus = 200;
const requests = { list: 0, feed: 0 };

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(1_000_000_000_000);
document.body.innerHTML = `<ytd-page-manager></ytd-page-manager>${GUIDE_HTML}`;
window.scrollTo = vi.fn();
vi.spyOn(console, 'warn').mockImplementation(() => {});
globalThis.chrome = { runtime: { id: 'test' }, storage: { local: area, onChanged: { addListener: () => {} } } };
globalThis.fetch = vi.fn(async (url) => {
  if (String(url).includes('/feed/channels')) {
    requests.list += 1;
    const html = channelsPageHtml(initialData([channelRenderer('alura', 'Alura'), channelRenderer('novo', 'Novo')]));
    return { ok: true, text: async () => html };
  }
  requests.feed += 1;
  if (feedStatus !== 200) return { ok: false, status: feedStatus, text: async () => '' };
  return { ok: true, text: async () => channelsPageHtml({ contents: feedVideos }) };
});
afterAll(() => vi.useRealTimers());

const openCategories = async () => {
  document.querySelector(`#${ENTRY_ID} button`).click();
  await flush();
};
const later = (ms) => vi.setSystemTime(Date.now() + ms);
const counted = () => ({ ...requests });

it('a fresh install fetches the list and the feed once', async () => {
  await import('../../src/content/main.js');
  await flush();
  await openCategories();
  expect(counted()).toEqual({ list: 1, feed: 1 });
});

it('reopening within 5 minutes fetches nothing', async () => {
  later(4 * MINUTE);
  await openCategories();
  expect(counted()).toEqual({ list: 1, feed: 1 });
});

it('after 5 minutes only the feed is fetched, and new videos are merged with the stored ones', async () => {
  feedVideos = [video('bbbbbbbbbbb', 'alura'), video('aaaaaaaaaaa', 'alura')];
  later(MINUTE);
  await openCategories();
  expect(counted()).toEqual({ list: 1, feed: 2 });
  expect(area.dump().feedItems.map((item) => item.videoId).sort()).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
});

it('a video from an unknown channel fetches the list again, at most once an hour', async () => {
  feedVideos = [video('ccccccccccc', 'estranho'), video('bbbbbbbbbbb', 'alura')];
  later(61 * MINUTE);
  await openCategories();
  expect(counted()).toEqual({ list: 2, feed: 3 });

  later(5 * MINUTE);
  await openCategories();
  expect(counted()).toEqual({ list: 2, feed: 4 });
});

it('a 429 on the feed pauses the next refreshes', async () => {
  feedStatus = 429;
  later(5 * MINUTE);
  await openCategories();
  expect(counted()).toEqual({ list: 2, feed: 5 });
  expect(area.dump().requestBudget.pausedUntil).toBeGreaterThan(Date.now());

  feedStatus = 200;
  later(5 * MINUTE);
  await openCategories();
  expect(counted()).toEqual({ list: 2, feed: 5 });
});

it('the Sync button fetches everything and replaces the stored feed', async () => {
  feedVideos = [video('ddddddddddd', 'alura')];
  later(10 * MINUTE);
  await openCategories();
  const syncButton = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Sincronizar');
  syncButton.click();
  await flush();
  expect(requests.list).toBe(3);
  expect(area.dump().feedItems.map((item) => item.videoId)).toEqual(['ddddddddddd']);
});
