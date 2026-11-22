// Feed por categoria na página de Categorias (abas Vídeos · Shorts · Canais).
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
// Ids de vídeo têm 11 caracteres; derivados do canal para serem previsíveis nos testes.
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

describe('abas da categoria', () => {
  it('abrir uma categoria mostra Vídeos · Shorts · Canais com Vídeos selecionada', async () => {
    await open({ initialFilter: 'prog' });
    expect($$('[role="tab"]').map((node) => [node.textContent, node.getAttribute('aria-selected')])).toEqual([
      ['Vídeos', 'true'], ['Shorts', 'false'], ['Canais', 'false'],
    ]);
    expect($('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe('tstb-tab-videos');
  });

  it('"Todas" e "Sem categoria" continuam sendo telas de organizar, sem abas', async () => {
    await open();
    expect($$('[role="tab"]')).toEqual([]);
    expect($('.tstb-grid')).not.toBeNull();
  });

  it('as setas do teclado trocam de aba, com volta circular', async () => {
    await open({ initialFilter: 'prog' });
    tablistKey('ArrowRight');
    expect(tab('Shorts').getAttribute('aria-selected')).toBe('true');
    tablistKey('ArrowLeft');
    tablistKey('ArrowLeft');
    expect(tab('Canais').getAttribute('aria-selected')).toBe('true');
  });

  it('na aba Canais aparecem a grade de canais e o seletor de ordem; no feed, não', async () => {
    await open({ initialFilter: 'prog' });
    expect($('.tstb-sort-select')).toBeNull();
    tab('Canais').click();
    expect($('.tstb-sort-select')).not.toBeNull();
    expect($$('.tstb-card')).toHaveLength(2);
  });
});

describe('aba Vídeos', () => {
  it('mostra na hora os vídeos da categoria vindos da sincronização, sem nenhuma requisição', async () => {
    await open({ initialFilter: 'prog' });
    await flush();
    expect(source.load).not.toHaveBeenCalled();
    expect(videoTitles()).toEqual(['Vídeo feedRocket1', 'Vídeo feedAlura01']);
  });

  it('cada cartão tem miniatura com duração, link, canal e "visualizações • tempo" no idioma', async () => {
    await open({ initialFilter: 'prog' });
    const card = $$('.tstb-video').find((node) => node.textContent.includes('feedAlura01'));
    expect(card.querySelector('.tstb-video-thumb img').getAttribute('src')).toBe('https://i.ytimg.com/vi/feedAlura01/mqdefault.jpg');
    expect(card.querySelector('.tstb-duration').textContent).toBe('10:05');
    expect(card.querySelector('.tstb-video-title a').href).toBe('https://www.youtube.com/watch?v=feedAlura01');
    expect(card.querySelector('.tstb-video-channel').textContent).toBe('Alura');
    expect(card.querySelector('.tstb-video-avatar').getAttribute('src')).toBe('https://yt3.example/alura.jpg');
    // O formato compacto usa espaço inquebrável ("921 mil" não quebra de linha); a comparação normaliza.
    expect(card.querySelector('.tstb-video-meta').textContent.replace(/\s/g, ' ')).toBe('921 mil visualizações • há 2 dias');
  });

  it('"Carregar vídeos mais antigos" busca os canais em lote e mistura por data', async () => {
    await open({ initialFilter: 'prog' });
    button('Carregar vídeos mais antigos').click();
    await flush();
    expect(source.load).toHaveBeenCalledTimes(2);
    const old = (id) => `Vídeo ${fakeId(channels[id], 'old')}`;
    expect(videoTitles()).toEqual(['Vídeo feedRocket1', 'Vídeo feedAlura01', old('/@rocket'), old('/@alura')]);
    expect(page().textContent).toContain('Você chegou ao fim desta categoria.');
  });

  it('a busca do cabeçalho filtra o feed por título ou canal', async () => {
    await open({ initialFilter: 'prog' });
    const search = $('.tstb-search-input');
    search.value = 'rocketseat';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect(videoTitles()).toEqual(['Vídeo feedRocket1']);
  });
});

describe('aba Shorts', () => {
  it('abrir a aba carrega o primeiro lote, mostra esqueletos enquanto isso e intercala os canais', async () => {
    const pending = [];
    const original = source.load.getMockImplementation();
    source.load.mockImplementation((channel, tabName) => new Promise((resolve) => pending.push(() => resolve(original(channel, tabName)))));
    await open({ initialFilter: 'prog', initialTab: 'shorts' });
    await flush();
    expect($$('.tstb-skeleton-short').length).toBeGreaterThan(0);
    expect($('[role="tabpanel"]').getAttribute('aria-busy')).toBe('true');

    pending.forEach((finish) => finish());
    await flush();
    // Rocketseat publicou mais recentemente, então vem primeiro; os canais se alternam.
    expect($$('.tstb-short-title').map((node) => node.textContent)).toEqual(['Short 1 Rocketseat', 'Short 1 Alura', 'Short 2 Rocketseat', 'Short 2 Alura']);
    const firstShort = fakeId(channels['/@rocket'], 'sh1');
    expect($('.tstb-short-link').href).toBe(`https://www.youtube.com/shorts/${firstShort}`);
    expect($('.tstb-short-thumb img').getAttribute('src')).toBe(`https://i.ytimg.com/vi/${firstShort}/oar2.jpg`);
    expect($('.tstb-short-meta').textContent.replace(/\s/g, ' ')).toBe('Rocketseat • 2 mil visualizações');
    expect($$('.tstb-skeleton')).toEqual([]);
  });

  it('se o YouTube limitar as consultas, explica e deixa tentar de novo', async () => {
    source.load.mockRejectedValue(new LocalizedError('error.rateLimited'));
    await open({ initialFilter: 'prog', initialTab: 'shorts' });
    await flush();
    expect(page().textContent).toContain('Muitas consultas em pouco tempo');
    expect(button('Carregar mais Shorts')).toBeDefined();
  });
});

describe('estados vazios do feed', () => {
  it('categoria sem canais convida a organizar e leva à aba Canais', async () => {
    await open({ initialFilter: 'vazia' });
    expect(page().textContent).toContain('Esta categoria ainda não tem canais');
    button('Organizar canais').click();
    expect(tab('Canais').getAttribute('aria-selected')).toBe('true');
  });

  it('sem vídeos recentes, oferece carregar os mais antigos', async () => {
    area = createFakeStorageArea({ channels, categories, feedItems: [], lastSyncedAt: NOW, uploadsSyncedAt: NOW, feedSyncedAt: NOW });
    await open({ initialFilter: 'prog' });
    expect(page().textContent).toContain('Nenhum vídeo recente');
    expect(button('Carregar vídeos mais antigos')).toBeDefined();
  });
});
