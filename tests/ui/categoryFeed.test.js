// Per-category feed on the Categories page (Videos · Shorts · Channels tabs).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalizedError } from '../../src/i18n/errors.js';
import { createStore } from '../../src/storage/store.js';
import { closeCategoryMenu } from '../../src/ui/components/categoryMenu.js';
import { openCategoriesPage, PAGE_ID } from '../../src/ui/page.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';

const HOUR = 3_600_000;
const NOW = 1_000 * HOUR;
const ucid = (n) => `UC${String(n).padStart(22, '0')}`;
const channels = {
  '/@alura': { id: '/@alura', name: 'Alura', url: 'https://www.youtube.com/@alura', avatar: 'https://yt3.example/alura.jpg', ucid: ucid(1) },
  '/@rocket': { id: '/@rocket', name: 'Rocketseat', url: 'https://www.youtube.com/@rocket', avatar: '', ucid: ucid(2) },
  '/@bossa': { id: '/@bossa', name: 'Bossa Nova', url: 'https://www.youtube.com/@bossa', avatar: '', ucid: ucid(3) },
};
const categories = [
  { id: 'prog', name: 'Programação', channelIds: ['/@alura', '/@rocket'] },
  { id: 'vazia', name: 'Vazia', channelIds: [] },
];
const video = (videoId, channelId, hoursAgo, extra = {}) => ({
  videoId, channelId, title: `Vídeo ${videoId}`, publishedAt: NOW - hoursAgo * HOUR, duration: '10:05', viewCount: 921_000, ...extra,
});
const feedItems = [video('feedAlura01', '/@alura', 48), video('feedBossa01', '/@bossa', 1), video('feedRocket1', '/@rocket', 5)];
// Video ids are 11 characters long; derived from the channel so they are predictable in tests.
const fakeId = (channel, suffix) => `${channel.id.slice(2, 7)}${suffix}`.padEnd(11, 'x').slice(0, 11);

let area;
let source;

beforeEach(() => {
  closeCategoryMenu();
  document.body.innerHTML = '<ytd-page-manager></ytd-page-manager>';
  window.scrollTo = vi.fn();
  area = createFakeStorageArea({
    channels, categories, feedItems, lastSyncedAt: NOW, uploadsSyncedAt: NOW, feedSyncedAt: NOW,
    latestUploads: { '/@rocket': NOW - 5 * HOUR, '/@alura': NOW - 48 * HOUR },
  });
  source = {
    cached: vi.fn(async () => null),
    load: vi.fn(async (channel, tab) => (tab === 'shorts'
      ? [1, 2].map((n) => ({ videoId: fakeId(channel, `sh${n}`), channelId: channel.id, title: `Short ${n} ${channel.name}`, viewCount: 2_000 }))
      : [video(fakeId(channel, 'old'), channel.id, 24 * 30)])),
  };
});

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};
const page = () => document.getElementById(PAGE_ID);
const $ = (selector) => page().querySelector(selector);
const $$ = (selector) => [...page().querySelectorAll(selector)];
const tab = (name) => $$('[role="tab"]').find((node) => node.textContent === name);
const button = (label) => $$('button').find((node) => node.textContent.trim() === label);
const videoTitles = () => $$('.tstb-video-title').map((node) => node.textContent);
const tablistKey = (key) => $('[role="tablist"]').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
const open = (options = {}) => openCategoriesPage({ store: createStore(area), feedSource: source, now: () => NOW, searchDelay: 0, ...options });

describe('category tabs', () => {
  it('opening a category shows Videos · Shorts · Channels with Videos selected', async () => {
    await open({ initialFilter: 'prog' });
    expect($$('[role="tab"]').map((node) => [node.textContent, node.getAttribute('aria-selected')])).toEqual([
      ['Vídeos', 'true'], ['Shorts', 'false'], ['Canais', 'false'],
    ]);
    expect($('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe('tstb-tab-videos');
  });

  it('"Todas" and "Sem categoria" are still organizing screens, without tabs', async () => {
    await open();
    expect($$('[role="tab"]')).toEqual([]);
    expect($('.tstb-grid')).not.toBeNull();
  });

  it('arrow keys switch tabs, wrapping around', async () => {
    await open({ initialFilter: 'prog' });
    tablistKey('ArrowRight');
    expect(tab('Shorts').getAttribute('aria-selected')).toBe('true');
    tablistKey('ArrowLeft');
    tablistKey('ArrowLeft');
    expect(tab('Canais').getAttribute('aria-selected')).toBe('true');
  });

  it("the Channels tab shows the channel grid and the sort control; the feed doesn't", async () => {
    await open({ initialFilter: 'prog' });
    expect($('.tstb-sort-select')).toBeNull();
    tab('Canais').click();
    expect($('.tstb-sort-select')).not.toBeNull();
    expect($$('.tstb-card')).toHaveLength(2);
  });

  it('puts the sort control in the tab bar, next to the tabs it applies to, with an icon instead of a text label', async () => {
    await open({ initialFilter: 'prog' });
    tab('Canais').click();
    const select = $('.tstb-sort-select');
    expect(select.closest('.tstb-tabbar')).not.toBeNull();
    expect(select.closest('[role="tablist"]')).toBeNull();
    expect($('.tstb-view-heading .tstb-sort-select')).toBeNull();
    expect(select.getAttribute('aria-label')).toBe('Ordenar');
    expect(select.closest('.tstb-sort').querySelector('svg')).not.toBeNull();
    expect($('.tstb-sort').textContent).not.toContain('Ordenar:');
  });
});

describe('Videos tab', () => {
  it("shows the category's videos from the sync right away, without any request", async () => {
    await open({ initialFilter: 'prog' });
    await flush();
    expect(source.load).not.toHaveBeenCalled();
    expect(videoTitles()).toEqual(['Vídeo feedRocket1', 'Vídeo feedAlura01']);
  });

  it('each card has a thumbnail with duration, a link, the channel and "views • time" in the language', async () => {
    await open({ initialFilter: 'prog' });
    const card = $$('.tstb-video').find((node) => node.textContent.includes('feedAlura01'));
    expect(card.querySelector('.tstb-video-thumb img').getAttribute('src')).toBe('https://i.ytimg.com/vi/feedAlura01/mqdefault.jpg');
    expect(card.querySelector('.tstb-duration').textContent).toBe('10:05');
    expect(card.querySelector('.tstb-video-title a').href).toBe('https://www.youtube.com/watch?v=feedAlura01');
    expect(card.querySelector('.tstb-video-channel').textContent).toBe('Alura');
    expect(card.querySelector('.tstb-video-avatar').getAttribute('src')).toBe('https://yt3.example/alura.jpg');
    // The compact format uses a non-breaking space ("921 mil" doesn't wrap); the comparison
    // normalizes it.
    expect(card.querySelector('.tstb-video-meta').textContent.replace(/\s/g, ' ')).toBe('921 mil visualizações • há 2 dias');
  });

  it('"Carregar vídeos mais antigos" fetches the channels in a batch and merges them by date', async () => {
    await open({ initialFilter: 'prog' });
    button('Carregar vídeos mais antigos').click();
    await flush();
    expect(source.load).toHaveBeenCalledTimes(2);
    const old = (id) => `Vídeo ${fakeId(channels[id], 'old')}`;
    expect(videoTitles()).toEqual(['Vídeo feedRocket1', 'Vídeo feedAlura01', old('/@rocket'), old('/@alura')]);
    expect(page().textContent).toContain('Você chegou ao fim desta categoria.');
  });

  it('the header search filters the feed by title or channel', async () => {
    await open({ initialFilter: 'prog' });
    const search = $('.tstb-search-input');
    search.value = 'rocketseat';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect(videoTitles()).toEqual(['Vídeo feedRocket1']);
  });
});

describe('Shorts tab', () => {
  it('opening the tab loads the first batch, shows skeletons meanwhile and interleaves the channels', async () => {
    const pending = [];
    const original = source.load.getMockImplementation();
    source.load.mockImplementation((channel, tabName) => new Promise((resolve) => pending.push(() => resolve(original(channel, tabName)))));
    await open({ initialFilter: 'prog', initialTab: 'shorts' });
    await flush();
    expect($$('.tstb-skeleton-short').length).toBeGreaterThan(0);
    expect($('[role="tabpanel"]').getAttribute('aria-busy')).toBe('true');

    pending.forEach((finish) => finish());
    await flush();
    // Rocketseat published most recently, so it comes first; the channels alternate.
    expect($$('.tstb-short-title').map((node) => node.textContent)).toEqual(['Short 1 Rocketseat', 'Short 1 Alura', 'Short 2 Rocketseat', 'Short 2 Alura']);
    const firstShort = fakeId(channels['/@rocket'], 'sh1');
    expect($('.tstb-short-link').href).toBe(`https://www.youtube.com/shorts/${firstShort}`);
    expect($('.tstb-short-thumb img').getAttribute('src')).toBe(`https://i.ytimg.com/vi/${firstShort}/oar2.jpg`);
    expect($('.tstb-short-meta').textContent.replace(/\s/g, ' ')).toBe('Rocketseat • 2 mil visualizações');
    expect($$('.tstb-skeleton')).toEqual([]);
  });

  it('if YouTube limits the requests, explains it and allows a retry', async () => {
    source.load.mockRejectedValue(new LocalizedError('error.rateLimited'));
    await open({ initialFilter: 'prog', initialTab: 'shorts' });
    await flush();
    expect(page().textContent).toContain('Muitas consultas em pouco tempo');
    expect(button('Carregar mais Shorts')).toBeDefined();
  });
});

// Regression: on YouTube, clicking "Load more" took the page back to the top. The feed panel was
// recreated on every render and the card list left it for an instant, making the page short; the
// focused button was removed and, on blur, YouTube measured the layout at that moment: the browser
// adjusted the scroll to fit, at the top. Focus also fell to <body>.
describe('"Carregar mais" keeps the place on the page', () => {
  const manyShorts = async (channel) => Array.from({ length: 30 }, (_, n) => ({ videoId: fakeId(channel, `s${String(n).padStart(2, '0')}`), channelId: channel.id, title: `Short ${n}`, viewCount: 10 }));

  it('the card list never leaves the page and the focus stays on the button', async () => {
    source.load = vi.fn(manyShorts);
    await open({ initialFilter: 'prog', initialTab: 'shorts' });
    await flush();
    const grid = $('.tstb-shorts-grid');
    const removed = [];
    const observer = new MutationObserver((records) => records.forEach((record) => removed.push(...record.removedNodes)));
    observer.observe(page(), { childList: true, subtree: true });

    const loadMore = button('Carregar mais Shorts');
    loadMore.focus();
    loadMore.click();
    await flush();
    observer.disconnect();

    expect($$('.tstb-short')).toHaveLength(48);
    expect(removed).not.toContain(grid);
    expect(removed.some((node) => node.contains?.(grid))).toBe(false);
    expect(document.activeElement).toBe(button('Carregar mais Shorts'));
  });
});

describe('feed empty states', () => {
  it('a category without channels invites organizing and leads to the Channels tab', async () => {
    await open({ initialFilter: 'vazia' });
    expect(page().textContent).toContain('Esta categoria ainda não tem canais');
    button('Organizar canais').click();
    expect(tab('Canais').getAttribute('aria-selected')).toBe('true');
  });

  it('without recent videos, offers to load older ones', async () => {
    area = createFakeStorageArea({ channels, categories, feedItems: [], lastSyncedAt: NOW, uploadsSyncedAt: NOW, feedSyncedAt: NOW });
    await open({ initialFilter: 'prog' });
    expect(page().textContent).toContain('Nenhum vídeo recente');
    expect(button('Carregar vídeos mais antigos')).toBeDefined();
  });
});

describe('Categories page URL', () => {
  const path = () => window.location.pathname + window.location.hash;

  beforeEach(() => window.history.replaceState(null, '', '/watch?v=abc'));

  it('opening adds a history entry; switching category or tab only replaces it', async () => {
    const before = window.history.length;
    await open({ initialFilter: 'prog' });
    expect(path()).toBe('/feed/subscriptions#tstb=prog');
    expect(window.history.length).toBe(before + 1);

    tab('Shorts').click();
    expect(path()).toBe('/feed/subscriptions#tstb=prog&tab=shorts');
    $$('[aria-pressed]').find((node) => node.textContent.includes('Todas')).click();
    expect(path()).toBe('/feed/subscriptions#tstb=all');
    expect(window.history.length).toBe(before + 1);
  });

  it('the initial tab comes from the options, as in a URL with tab', async () => {
    await open({ initialFilter: 'prog', initialTab: 'channels' });
    expect(tab('Canais').getAttribute('aria-selected')).toBe('true');
    expect(path()).toBe('/feed/subscriptions#tstb=prog&tab=channels');
  });

  it('a category that no longer exists falls back to Todas and fixes the URL', async () => {
    await open({ initialFilter: 'apagada' });
    expect(path()).toBe('/feed/subscriptions#tstb=all');
  });
});
