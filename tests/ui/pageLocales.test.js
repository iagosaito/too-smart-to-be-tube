// The UI follows YouTube's language (<html lang>); the CSV is always in English.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectSidebarEntry } from '../../src/dom/sidebar.js';
import { parseCsv } from '../../src/import/csvParse.js';
import { planImport, readImport } from '../../src/import/categorizationImport.js';
import { createStore } from '../../src/storage/store.js';
import { createSyncCoordinator } from '../../src/sync/syncCoordinator.js';
import { closeCategoryMenu, MENU_ID } from '../../src/ui/components/categoryMenu.js';
import { openCategoriesPage, PAGE_ID } from '../../src/ui/page.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const DAY = 24 * 3_600_000;
const NOW = 100 * DAY;
const channels = {
  '/@alura': { id: '/@alura', name: 'Alura', url: 'https://www.youtube.com/@alura', avatar: '' },
  '/@bossa': { id: '/@bossa', name: 'Bossa Nova', url: 'https://www.youtube.com/@bossa', avatar: '' },
};
const categories = [{ id: 'tech', name: 'Tech', channelIds: ['/@alura'] }];

let download;

beforeEach(() => {
  closeCategoryMenu();
  document.body.innerHTML = '<ytd-page-manager></ytd-page-manager>';
  window.scrollTo = vi.fn();
  download = vi.fn();
});

afterEach(() => {
  document.documentElement.lang = 'pt-BR';
});

async function openIn(lang) {
  document.documentElement.lang = lang;
  const area = createFakeStorageArea({
    channels,
    categories,
    lastSyncedAt: NOW - 5 * 60_000,
    uploadsSyncedAt: NOW, feedSyncedAt: NOW - 5 * 60_000,
    latestUploads: { '/@bossa': NOW - 2 * DAY },
  });
  await openCategoriesPage({ store: createStore(area), sync: createSyncCoordinator(vi.fn(), { cooldownMs: 0 }), download, now: () => NOW });
  return document.getElementById(PAGE_ID);
}

const text = (page, selector) => page.querySelector(selector).textContent;
const chipLabels = (page) => [...page.querySelectorAll('.tstb-chip-label')].map((node) => node.textContent);
const card = (page, name) => [...page.querySelectorAll('.tstb-card')].find((node) => node.textContent.includes(name));

describe.each([
  {
    lang: 'en',
    title: 'Categories',
    subtitle: '2 subscriptions · Synced 5 minutes ago',
    chips: ['All', 'Tech', 'No category'],
    heading: 'All subscriptions · 2 channels',
    sync: 'Sync',
    upload: 'Video 2 days ago',
    pill: 'No category',
  },
  {
    lang: 'es-419',
    title: 'Categorías',
    subtitle: '2 suscripciones · Sincronizado hace 5 minutos',
    chips: ['Todas', 'Tech', 'Sin categoría'],
    heading: 'Todas las suscripciones · 2 canales',
    sync: 'Sincronizar',
    upload: 'Video hace 2 días',
    pill: 'Sin categoría',
  },
])('Categories page with YouTube in $lang', (expected) => {
  it("shows the title, status, chips and view title in YouTube's language", async () => {
    const page = await openIn(expected.lang);
    expect(text(page, 'h1')).toBe(expected.title);
    expect(text(page, '.tstb-subtitle')).toBe(expected.subtitle);
    expect(chipLabels(page)).toEqual(expected.chips);
    expect(text(page, '.tstb-view-title')).toBe(expected.heading);
    expect([...page.querySelectorAll('.tstb-header-actions button')].map((node) => node.textContent)).toContain(expected.sync);
  });

  it("translates the latest video date and the card's category menu", async () => {
    const page = await openIn(expected.lang);
    expect(text(card(page, 'Bossa'), '.tstb-card-meta')).toBe(expected.upload);
    card(page, 'Bossa').querySelector('.tstb-pill').click();
    expect(document.getElementById(MENU_ID).querySelector('.tstb-menu-item').textContent).toBe(expected.pill);
  });
});

describe('sidebar item', () => {
  it.each([
    ['en', 'Categories'],
    ['pt-BR', 'Categorias'],
    ['es', 'Categorías'],
  ])('with YouTube in %s shows "%s"', (lang, label) => {
    document.documentElement.lang = lang;
    document.body.innerHTML = GUIDE_HTML;
    const entry = injectSidebarEntry(document.querySelector('ytd-guide-renderer'), () => {});
    expect(entry.textContent).toBe(label);
  });
});

describe('CSV always in English', () => {
  it.each(['en', 'pt-BR', 'es'])('with the UI in %s the exported file is the same', async (lang) => {
    const page = await openIn(lang);
    [...page.querySelectorAll('.tstb-header-actions button')].at(-1).click();
    const [fileName, csv] = download.mock.calls[0];
    // The date depends on the machine's time zone; the date format has its own test.
    expect(fileName).toMatch(/^youtube-subscriptions-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toBe(
      '﻿Channel,Category,URL,Identifier\r\n' +
        'Alura,Tech,https://www.youtube.com/@alura,/@alura\r\n' +
        'Bossa Nova,,https://www.youtube.com/@bossa,/@bossa\r\n',
    );
  });

  it('imports the English format, with "No category" or an empty cell as uncategorized', () => {
    const csv = 'Channel,Category,URL,Identifier\r\nAlura,No category,,/@alura\r\nBossa Nova,Music,,/@bossa\r\n';
    const { categories: next, summary } = planImport({ channels, categories }, readImport(parseCsv(csv)).entries);
    expect(next.map((category) => [category.name, category.channelIds])).toEqual([['Tech', []], ['Music', ['/@bossa']]]);
    expect(summary).toMatchObject({ matched: 2, created: ['Music'] });
  });

  it('still imports files exported by the earlier version, in Portuguese', () => {
    const csv = 'Canal,Categoria,URL,Identificador\r\nAlura,Sem categoria,,/@alura\r\nBossa Nova,Música,,/@bossa\r\n';
    const { categories: next } = planImport({ channels, categories }, readImport(parseCsv(csv)).entries);
    expect(next.map((category) => [category.name, category.channelIds])).toEqual([['Tech', []], ['Música', ['/@bossa']]]);
  });
});
