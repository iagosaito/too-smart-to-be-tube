import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeCategoriesPage, isStale, OPEN_CLASS, openCategoriesPage, PAGE_ID } from '../../src/ui/page.js';
import { createStore } from '../../src/storage/store.js';
import { closeCategoryMenu, MENU_ID } from '../../src/ui/components/categoryMenu.js';
import { TOAST_ID } from '../../src/ui/components/feedback.js';
import { createSyncCoordinator } from '../../src/sync/syncCoordinator.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';

const channels = {
  '/@alura': { id: '/@alura', name: 'Alura', url: 'https://www.youtube.com/@alura', avatar: 'a.jpg' },
  '/@bossa': { id: '/@bossa', name: 'Bossa Nova', url: 'https://www.youtube.com/@bossa', avatar: '' },
  '/@xss': { id: '/@xss', name: '<img src=x onerror=alert(1)>', url: 'https://www.youtube.com/@xss', avatar: '' },
};
const categories = [{ id: 'tech', name: 'Tech', channelIds: ['/@alura'] }];
const HOUR = 60 * 60 * 1000;

let area;
let store;

beforeEach(() => {
  closeCategoryMenu();
  document.body.innerHTML = '<ytd-page-manager><ytd-browse id="home">Início</ytd-browse></ytd-page-manager>';
  document.documentElement.className = '';
  // jsdom doesn't implement scrolling and floods the output with warnings.
  window.scrollTo = vi.fn();
  // Recent sync: most tests must not trigger the automatic sync.
  area = createFakeStorageArea({ channels, categories, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 });
  store = createStore(area);
});

const page = () => document.getElementById(PAGE_ID);
const $ = (selector) => page().querySelector(selector);
const $$ = (selector) => [...page().querySelectorAll(selector)];
const chip = (label) => $$('.tstb-chip').find((node) => node.querySelector('.tstb-chip-label')?.textContent === label);
const button = (label) => $$('button').find((node) => node.textContent.trim() === label);
const cardNames = () => $$('.tstb-card-name').map((node) => node.textContent);
const checkFor = (name) => $$('.tstb-check').find((node) => node.getAttribute('aria-label') === `Selecionar ${name}`);
// Actions write to storage asynchronously; we wait for the task queue to drain.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
// Tests pass the sync as a plain function; here it becomes the real coordinator, with no minimum
// interval (the cooldown has its own tests).
function withCoordinator(options) {
  if (typeof options.sync !== 'function') return options;
  return { ...options, sync: createSyncCoordinator(options.sync, { now: options.now ?? (() => 1_000), cooldownMs: 0 }) };
}
const open = (options = {}) => openCategoriesPage({ store, now: () => 1_000, searchDelay: 0, ...withCoordinator(options) });

// Custom category menu on the cards (pill and move icon).
const menu = () => document.getElementById(MENU_ID);
const menuLabels = () => [...menu().querySelectorAll('.tstb-menu-item')].map((item) => item.textContent);
const checkedInMenu = () => menu().querySelector('[aria-checked="true"]')?.textContent;
function chooseInMenu(trigger, label) {
  trigger.click();
  [...menu().querySelectorAll('.tstb-menu-item')].find((item) => item.textContent === label).click();
}

function changeSelect(select, value) {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('mounting', () => {
  it('mounts the page inside ytd-page-manager and marks the html as open', async () => {
    await open();
    expect(page().parentElement.tagName).toBe('YTD-PAGE-MANAGER');
    expect(document.documentElement.classList.contains(OPEN_CLASS)).toBe(true);
  });

  it('falls back to the body when there is no ytd-page-manager', async () => {
    document.body.innerHTML = '';
    await open();
    expect(page().parentElement).toBe(document.body);
  });

  it("doesn't mount two pages at the same time", async () => {
    await open();
    await open();
    expect(document.querySelectorAll(`#${PAGE_ID}`)).toHaveLength(1);
  });

  it('closeCategoriesPage removes the page and the marker, even when called without a page', async () => {
    await open();
    closeCategoriesPage();
    expect(page()).toBeNull();
    expect(document.documentElement.classList.contains(OPEN_CLASS)).toBe(false);
    expect(() => closeCategoriesPage()).not.toThrow();
  });
});

describe('overview', () => {
  it('opens on "Todas" with every channel and the total in the subtitle', async () => {
    await open();
    expect(chip('Todas').getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toHaveLength(3);
    expect($('.tstb-subtitle').textContent).toBe('3 inscrições · Sincronizado agora');
  });

  it('shows one chip per category with its count', async () => {
    await open();
    expect(chip('Tech').querySelector('.tstb-chip-count').textContent).toBe('1');
    expect(chip('Sem categoria').querySelector('.tstb-chip-count').textContent).toBe('2');
  });

  it('renders channel names as text', async () => {
    await open();
    expect($('img[src="x"]')).toBeNull();
    expect(page().textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('each card is a link to the channel and shows its current category', async () => {
    await open();
    const card = $$('.tstb-card').find((node) => node.textContent.includes('Alura'));
    expect(card.querySelector('a').href).toBe('https://www.youtube.com/@alura');
    expect(card.querySelector('.tstb-pill').textContent).toBe('Tech');
  });
});

describe('alphabetical order of categories', () => {
  const unordered = [
    { id: 'v', name: 'Viagem', channelIds: [] },
    { id: 't', name: 'Tech', channelIds: ['/@alura'] },
    { id: 'c', name: 'Comida', channelIds: [] },
  ];
  const optionLabels = (select) => [...select.options].map((option) => option.textContent);
  afterEach(() => closeCategoryMenu());

  it('chips, pills and "Mover para…" use the same A–Z order', async () => {
    await open({ store: createStore(createFakeStorageArea({ channels, categories: unordered, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })) });
    expect($$('.tstb-chips [data-chip-id]:not(.tstb-chip-all):not(.tstb-chip-pending) .tstb-chip-label').map((node) => node.textContent)).toEqual(['Comida', 'Tech', 'Viagem']);
    $('.tstb-pill').click();
    expect(menuLabels()).toEqual(['Sem categoria', 'Comida', 'Tech', 'Viagem']);
    closeCategoryMenu();
    checkFor('Alura').click();
    expect(optionLabels($('.tstb-bulk-select'))).toEqual(['Mover para…', 'Comida', 'Tech', 'Viagem', 'Sem categoria']);
  });
});

describe('filters and search', () => {
  it('clicking a chip shows only that category, with editing tools', async () => {
    await open();
    chip('Tech').click();
    expect(cardNames()).toEqual(['Alura']);
    expect($('.tstb-view-title').textContent).toBe('Tech · 1 canal');
    expect($('[aria-label="Renomear categoria Tech"]')).not.toBeNull();
  });

  it('the search filters while keeping the focus in the field', async () => {
    await open();
    const search = $('.tstb-search-input');
    search.focus();
    search.value = 'bossa';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect(cardNames()).toEqual(['Bossa Nova']);
    expect(document.activeElement).toBe($('.tstb-search-input'));
  });

  it('a search without results shows an empty state with "Limpar busca"', async () => {
    await open();
    const search = $('.tstb-search-input');
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect($('.tstb-empty-state').textContent).toContain('Nenhum canal encontrado');
    button('Limpar busca').click();
    expect(cardNames()).toHaveLength(3);
  });

  it('an empty category offers a shortcut to "Sem categoria"', async () => {
    area = createFakeStorageArea({ channels, categories: [{ id: 'v', name: 'Vazia', channelIds: [] }], lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 });
    await open({ store: createStore(area) });
    chip('Vazia').click();
    button('Ver canais sem categoria').click();
    expect(chip('Sem categoria').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('categories', () => {
  it('creates through the "Nova categoria" chip and opens the new category right away', async () => {
    await open();
    button('Nova categoria').click();
    const input = $('.tstb-chip-input');
    input.value = 'Música';
    input.closest('form').requestSubmit();
    await flush();
    expect(area.dump().categories.map((c) => c.name)).toEqual(['Tech', 'Música']);
    expect(chip('Música').getAttribute('aria-pressed')).toBe('true');
  });

  it('Esc cancels the creation and brings the chip back', async () => {
    await open();
    button('Nova categoria').click();
    $('.tstb-chip-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('.tstb-chip-input')).toBeNull();
    expect(button('Nova categoria')).toBeDefined();
  });

  it('renames in the title itself', async () => {
    await open();
    chip('Tech').click();
    $('.tstb-title-edit').click();
    const input = $('.tstb-rename-input');
    expect(input.value).toBe('Tech');
    input.value = 'Tecnologia';
    input.closest('form').requestSubmit();
    await flush();
    expect(area.dump().categories[0].name).toBe('Tecnologia');
    expect($('.tstb-view-title').textContent).toContain('Tecnologia');
  });

  it('separates the category zone (name and delete) from the list zone (sort)', async () => {
    await open();
    chip('Tech').click();
    const titleGroup = $('.tstb-title-group');
    expect(titleGroup.querySelector('.tstb-title-edit')).not.toBeNull();
    // No pencil on the name: nothing reserves space between the name and the count.
    expect(titleGroup.querySelector('.tstb-title-edit svg')).toBeNull();
    expect(titleGroup.querySelector('[aria-label="Excluir categoria Tech"]')).not.toBeNull();
    expect($('.tstb-heading-actions').querySelector('[aria-label^="Excluir"]')).toBeNull();
    expect($('.tstb-heading-actions .tstb-sort-select')).not.toBeNull();
    expect(button('Renomear')).toBeUndefined();
  });

  it('"Todas" and "Sem categoria" have no editable title or delete', async () => {
    await open();
    expect($('.tstb-title-edit')).toBeNull();
    expect($('[aria-label^="Excluir categoria"]')).toBeNull();
    chip('Sem categoria').click();
    expect($('.tstb-title-edit')).toBeNull();
  });

  it('cancelling the rename goes back to the title', async () => {
    await open();
    chip('Tech').click();
    $('.tstb-title-edit').click();
    button('Cancelar').click();
    expect($('.tstb-rename-input')).toBeNull();
  });

  it('deletes after confirmation, goes back to "Todas" and shows a toast', async () => {
    const confirm = vi.fn(() => true);
    await open({ confirm });
    chip('Tech').click();
    $('[aria-label="Excluir categoria Tech"]').click();
    await flush();
    expect(confirm).toHaveBeenCalledWith('Excluir a categoria "Tech"? 1 canal volta para "Sem categoria".');
    expect(area.dump().categories).toEqual([]);
    expect(chip('Todas').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById(TOAST_ID).textContent).toBe('Categoria "Tech" excluída');
  });

  it("doesn't delete if the user cancels the confirmation", async () => {
    await open({ confirm: () => false });
    chip('Tech').click();
    $('[aria-label="Excluir categoria Tech"]').click();
    await flush();
    expect(area.dump().categories).toHaveLength(1);
  });

  it('moves a channel through the category pill', async () => {
    await open();
    const card = $$('.tstb-card').find((node) => node.textContent.includes('Bossa'));
    chooseInMenu(card.querySelector('.tstb-pill'), 'Tech');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual(['/@alura', '/@bossa']);
  });
});

describe('performance', () => {
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));

  it('selecting a channel recreates only its card; the others are the same nodes', async () => {
    await open();
    const alura = cardOf('Alura');
    const bossa = cardOf('Bossa');
    checkFor('Bossa Nova').click();
    expect(cardOf('Alura')).toBe(alura);
    expect(cardOf('Bossa')).not.toBe(bossa);
  });

  it('the search waits for a pause in typing before redrawing', async () => {
    await open({ searchDelay: 50 });
    const search = $('.tstb-search-input');
    search.value = 'bossa';
    search.dispatchEvent(new Event('input'));
    expect(cardNames()).toHaveLength(3);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cardNames()).toEqual(['Bossa Nova']);
  });

  it('renaming a category invalidates the cards (the menu options change)', async () => {
    await open();
    const alura = cardOf('Alura');
    chip('Tech').click();
    $('.tstb-title-edit').click();
    $('.tstb-rename-input').value = 'Tecnologia';
    $('.tstb-rename-input').closest('form').requestSubmit();
    await flush();
    expect(cardOf('Alura')).not.toBe(alura);
    cardOf('Alura').querySelector('.tstb-move').click();
    expect(menuLabels()).toContain('Tecnologia');
    closeCategoryMenu();
  });
});

describe('category control on the card per view', () => {
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));

  it('in "Todas" each card shows the pill with its category', async () => {
    await open();
    expect(cardOf('Alura').querySelector('.tstb-pill').textContent).toBe('Tech');
    expect(cardOf('Alura').querySelector('.tstb-move')).toBeNull();
  });

  it("inside a category doesn't repeat the pill; offers the move icon", async () => {
    await open();
    chip('Tech').click();
    const card = cardOf('Alura');
    expect(card.querySelector('.tstb-pill')).toBeNull();
    const move = card.querySelector('.tstb-move');
    expect(move.getAttribute('aria-label')).toBe('Mover Alura para outra categoria');
    move.click();
    expect(checkedInMenu()).toBe('Tech');
    closeCategoryMenu();
  });

  it('the move icon takes the channel out of the open category', async () => {
    await open();
    chip('Tech').click();
    chooseInMenu(cardOf('Alura').querySelector('.tstb-move'), 'Sem categoria');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual([]);
    expect($('.tstb-empty-state').textContent).toContain('Categoria vazia');
  });

  it('in "Sem categoria" the pill invites choosing instead of repeating "Sem categoria"', async () => {
    await open();
    chip('Sem categoria').click();
    const pill = cardOf('Bossa').querySelector('.tstb-pill');
    expect(pill.textContent).toBe('Escolher categoria…');
    chooseInMenu(pill, 'Tech');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual(['/@alura', '/@bossa']);
  });
});

describe('card category menu', () => {
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));

  it('clicking the pill again closes the menu without changing anything', async () => {
    await open();
    const pill = cardOf('Alura').querySelector('.tstb-pill');
    pill.click();
    expect(menu()).not.toBeNull();
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    pill.click();
    expect(menu()).toBeNull();
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(area.dump().categories).toEqual(categories);
  });

  it('choosing the current category saves nothing', async () => {
    const set = vi.spyOn(area, 'set');
    await open();
    chooseInMenu(cardOf('Alura').querySelector('.tstb-pill'), 'Tech');
    await flush();
    expect(set).not.toHaveBeenCalled();
  });

  it('closing the Categories page closes the open menu', async () => {
    await open();
    cardOf('Alura').querySelector('.tstb-pill').click();
    closeCategoriesPage();
    expect(menu()).toBeNull();
  });
});

describe('bulk selection', () => {
  it('selecting channels shows the bar with the count', async () => {
    await open();
    checkFor('Bossa Nova').click();
    checkFor('Alura').click();
    expect($('.tstb-bulkbar').textContent).toContain('2 canais selecionados');
    expect($$('.tstb-card-selected')).toHaveLength(2);
  });

  it('in selection mode, clicking the card selects it instead of navigating', async () => {
    await open();
    checkFor('Alura').click();
    const link = $$('.tstb-card-link').find((node) => node.textContent.includes('Bossa'));
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect($('.tstb-bulkbar').textContent).toContain('2 canais selecionados');
  });

  it('moves every selected channel at once, clears the selection and shows a toast', async () => {
    await open();
    checkFor('Bossa Nova').click();
    checkFor('<img src=x onerror=alert(1)>').click();
    changeSelect($('.tstb-bulk-select'), 'tech');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual(['/@alura', '/@bossa', '/@xss']);
    expect($('.tstb-bulkbar')).toBeNull();
    expect(document.getElementById(TOAST_ID).textContent).toBe('2 canais movidos para "Tech"');
  });

  it('unchecking and "Cancelar" clear the selection', async () => {
    await open();
    checkFor('Alura').click();
    checkFor('Alura').click();
    expect($('.tstb-bulkbar')).toBeNull();
    checkFor('Alura').click();
    button('Cancelar').click();
    expect($('.tstb-bulkbar')).toBeNull();
  });

  it('switching filters clears the selection', async () => {
    await open();
    checkFor('Alura').click();
    chip('Tech').click();
    expect($('.tstb-bulkbar')).toBeNull();
  });
});

// Regression: selected channels that left the screen (moved individually or hidden by the search)
// stayed selected, invisible, and were moved along by the bulk action, undoing what the user had
// just done.
describe('the selection only holds what is on screen', () => {
  const storeWith = (categoriesList) =>
    createStore(createFakeStorageArea({ channels, categories: categoriesList, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 }));
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));
  const channelIdsOf = (id) => area.dump().categories.find((category) => category.id === id).channelIds;

  it("moving a selected channel individually takes it out of the selection, and the batch doesn't move it again", async () => {
    area = createFakeStorageArea({
      channels,
      categories: [
        { id: 'tech', name: 'Tech', channelIds: ['/@alura', '/@bossa'] },
        { id: 'musica', name: 'Música', channelIds: [] },
        { id: 'livros', name: 'Livros', channelIds: [] },
      ],
      lastSyncedAt: 1_000,
      uploadsSyncedAt: 1_000,
    });
    await open({ store: createStore(area) });
    chip('Tech').click();
    checkFor('Alura').click();
    checkFor('Bossa Nova').click();

    chooseInMenu(cardOf('Alura').querySelector('.tstb-move'), 'Música');
    await flush();
    expect($('.tstb-bulkbar').textContent).toContain('1 canal selecionado');

    changeSelect($('.tstb-bulk-select'), 'livros');
    await flush();
    expect(channelIdsOf('musica')).toEqual(['/@alura']);
    expect(channelIdsOf('livros')).toEqual(['/@bossa']);
  });

  it("selected channels hidden by the search leave the selection and aren't moved", async () => {
    area = createFakeStorageArea({
      channels,
      categories: [{ id: 'livros', name: 'Livros', channelIds: [] }],
      lastSyncedAt: 1_000,
      uploadsSyncedAt: 1_000,
    });
    await open({ store: createStore(area) });
    checkFor('Alura').click();
    checkFor('Bossa Nova').click();

    const search = $('.tstb-search-input');
    search.value = 'bossa';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect($('.tstb-bulkbar').textContent).toContain('1 canal selecionado');

    changeSelect($('.tstb-bulk-select'), 'livros');
    await flush();
    expect(channelIdsOf('livros')).toEqual(['/@bossa']);
  });

  it('the visible selection stays intact when nothing leaves the screen', async () => {
    await open({ store: storeWith(categories) });
    checkFor('Alura').click();
    checkFor('Bossa Nova').click();
    const search = $('.tstb-search-input');
    search.value = 'a';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect($('.tstb-bulkbar').textContent).toContain('2 canais selecionados');
  });
});

describe('sync', () => {
  it('syncs automatically when the last sync is old', async () => {
    const sync = vi.fn(async () => store.replaceChannels(Object.values(channels), 2 * HOUR));
    await open({ sync, now: () => 1_000 + 2 * HOUR });
    await flush();
    expect(sync).toHaveBeenCalledOnce();
    expect($('.tstb-subtitle').textContent).toBe('3 inscrições · Sincronizado agora');
  });

  it('syncs automatically on a fresh install, which has never synced', async () => {
    const sync = vi.fn(async () => 3);
    await open({ store: createStore(createFakeStorageArea()), sync, now: () => 1_000 });
    expect(sync).toHaveBeenCalledOnce();
  });

  it('waits for the next regular sync when a recent one could not read the feed', async () => {
    const sync = vi.fn(async () => 3);
    await open({ store: createStore(createFakeStorageArea({ channels, categories, lastSyncedAt: 1_000 })), sync, now: () => 2_000 });
    expect(sync).not.toHaveBeenCalled();
  });

  it('in a background tab, the automatic sync waits for the tab to become visible', async () => {
    // Opening from a URL needs no click: a restored browser session may open several Categories
    // tabs at once, and each would start a full sync of dozens of authenticated requests.
    let visibility = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    try {
      const sync = vi.fn(async () => store.replaceChannels(Object.values(channels), 2 * HOUR));
      await open({ sync, now: () => 1_000 + 2 * HOUR });
      await flush();
      expect(sync).not.toHaveBeenCalled();

      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(sync).toHaveBeenCalledOnce();
    } finally {
      delete document.visibilityState;
    }
  });

  it("if another tab synced while this one was in the background, doesn't sync again", async () => {
    let visibility = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    try {
      const sync = vi.fn(async () => {});
      await open({ sync, now: () => 1_000 + 2 * HOUR });
      await store.replaceChannels(Object.values(channels), 1_000 + 2 * HOUR);
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(sync).not.toHaveBeenCalled();
    } finally {
      delete document.visibilityState;
    }
  });

  it("a page closed in the background doesn't sync when the tab becomes visible", async () => {
    let visibility = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    try {
      const sync = vi.fn(async () => {});
      await open({ sync, now: () => 1_000 + 2 * HOUR });
      closeCategoriesPage();
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(sync).not.toHaveBeenCalled();
    } finally {
      delete document.visibilityState;
    }
  });

  it('shows "Sincronizando…" and disables the button while it runs', async () => {
    let finish;
    const sync = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    await open({ sync });
    button('Sincronizar').click();
    expect(button('Sincronizando…').disabled).toBe(true);
    finish();
    await flush();
    expect(button('Sincronizar').disabled).toBe(false);
  });

  it('shows the error in the subtitle when the sync fails', async () => {
    const sync = vi.fn(async () => {
      throw new Error('você precisa estar logado no YouTube');
    });
    await open({ sync });
    button('Sincronizar').click();
    await flush();
    expect($('.tstb-error').textContent).toBe('3 inscrições · Falha ao sincronizar: você precisa estar logado no YouTube');
  });

  it('without channels, the empty state offers to sync', async () => {
    const sync = vi.fn(async () => 0);
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })), sync });
    expect($('.tstb-empty-state').textContent).toContain('Nenhuma inscrição ainda');
    button('Sincronizar inscrições').click();
    expect(sync).toHaveBeenCalledOnce();
  });

  it('hides the button when there is no sync function', async () => {
    await open();
    expect(button('Sincronizar')).toBeUndefined();
  });
});

describe('CSV export', () => {
  it('downloads every subscription, even with an active filter and search, and shows a toast', async () => {
    const download = vi.fn();
    await open({ download, now: () => new Date(2026, 10, 22).getTime() });
    chip('Tech').click();
    button('Exportar CSV').click();
    const [fileName, csv] = download.mock.calls[0];
    expect(fileName).toBe('youtube-subscriptions-2026-11-22.csv');
    expect(csv.trim().split('\r\n')).toHaveLength(4);
    expect(csv).toContain('Alura,Tech,https://www.youtube.com/@alura,/@alura');
    expect(document.getElementById(TOAST_ID).textContent).toBe('3 inscrições exportadas');
  });

  it('is disabled without subscriptions', async () => {
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })) });
    expect(button('Exportar CSV').disabled).toBe(true);
  });
});

describe('CSV import', () => {
  const fakeFile = (text, { name = 'categorias.csv', size = text.length } = {}) => ({ name, size, text: async () => text });
  const CSV = 'Canal,Categoria,URL,Identificador\r\nAlura,Tech,,/@alura\r\nBossa Nova,Música,,/@bossa\r\nFantasma,Nada,,/@fantasma\r\n';
  const importFile = async (file, options = {}) => {
    await open({ pickFile: async () => file, ...options });
    button('Importar CSV').click();
    await flush();
  };

  it('shows the review with the impact before applying, saving nothing', async () => {
    await importFile(fakeFile(CSV));
    const review = $('.tstb-review');
    expect(review.textContent).toContain('2 canais serão organizados em 2 categorias');
    expect(review.textContent).toContain('1 categoria nova: Música');
    expect(review.textContent).toContain('1 canal muda de categoria');
    expect(review.querySelector('details').textContent).toContain('Fantasma');
    expect(area.dump().categories).toEqual(categories);
    expect(document.activeElement).toBe(review.querySelector('h3'));
  });

  it('applies, shows the toast with Desfazer, and Desfazer restores the previous organization', async () => {
    await importFile(fakeFile(CSV));
    button('Aplicar importação').click();
    await flush();
    expect(area.dump().categories.map((c) => [c.name, c.channelIds])).toEqual([['Tech', ['/@alura']], ['Música', ['/@bossa']]]);
    expect($('.tstb-review')).toBeNull();
    const toast = document.getElementById(TOAST_ID);
    expect(toast.textContent).toContain('2 canais organizados em 2 categorias');
    toast.querySelector('button').click();
    await flush();
    expect(area.dump().categories).toEqual(categories);
  });

  it('cancelling closes the review without saving', async () => {
    await importFile(fakeFile(CSV));
    button('Cancelar').click();
    expect($('.tstb-review')).toBeNull();
    expect(area.dump().categories).toEqual(categories);
  });

  it('does nothing if the user closes the picker without choosing a file', async () => {
    await importFile(null);
    expect($('.tstb-review')).toBeNull();
  });

  it('explains the format error and only offers Fechar', async () => {
    await importFile(fakeFile('Nome,Outra\r\nA,B'));
    expect($('.tstb-review-error').textContent).toContain('coluna "Category"');
    expect(button('Aplicar importação')).toBeUndefined();
    button('Fechar').click();
    expect($('.tstb-review')).toBeNull();
  });

  it('warns when no row matches the subscriptions', async () => {
    await importFile(fakeFile('Identificador,Categoria\r\n/@ninguem,Tech'));
    expect($('.tstb-review-error').textContent).toContain('Nenhuma linha do arquivo corresponde');
  });

  it("shows the error and doesn't allow applying when the file would create too many categories", async () => {
    const rows = Array.from({ length: 1_001 }, (_, i) => `${i === 0 ? '/@alura' : `/@extra${i}`},Nova ${i}`);
    const many = Object.fromEntries(Array.from({ length: 1_001 }, (_, i) => [`/@extra${i}`, { id: `/@extra${i}`, name: `Extra ${i}`, url: '', avatar: '' }]));
    area = createFakeStorageArea({ channels: { ...channels, ...many }, categories, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 });
    await importFile(fakeFile(`Identifier,Category\r\n${rows.join('\r\n')}`), { store: createStore(area) });
    expect($('.tstb-review-error').textContent).toContain('mais de 1.000 categorias novas');
    expect(button('Aplicar importação')).toBeUndefined();
    expect(area.dump().categories).toEqual(categories);
  });

  it('accepts a file of exactly the maximum size (5 MB)', async () => {
    await importFile(fakeFile(CSV, { size: 5 * 1024 * 1024 }));
    expect($('.tstb-review-error')).toBeNull();
    expect(button('Aplicar importação')).toBeDefined();
  });

  it('rejects, without reading it, a file 1 byte over the maximum', async () => {
    const text = vi.fn();
    await importFile({ name: 'grande.csv', size: 5 * 1024 * 1024 + 1, text });
    expect($('.tstb-review-error').textContent).toContain('grande demais');
    expect(text).not.toHaveBeenCalled();
  });

  it('rejects files that are too large without reading them', async () => {
    const text = vi.fn();
    await importFile({ name: 'video.mp4', size: 50 * 1024 * 1024, text });
    expect($('.tstb-review-error').textContent).toContain('grande demais');
    expect(text).not.toHaveBeenCalled();
  });

  it('is disabled without subscriptions', async () => {
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })) });
    expect(button('Importar CSV').disabled).toBe(true);
  });
});

describe('sort by latest video', () => {
  const NOW = 10 * 24 * 3_600_000;
  const withUploads = (extra = {}) =>
    createStore(createFakeStorageArea({ channels, categories, lastSyncedAt: NOW, uploadsSyncedAt: NOW, feedSyncedAt: NOW, latestUploads: { '/@bossa': NOW - 2 * 24 * 3_600_000, '/@xss': NOW - 3_600_000 }, ...extra }));
  const sortSelect = () => $('.tstb-sort-select');

  it('starts in A–Z and shows the date of the latest video on the card', async () => {
    await open({ store: withUploads(), now: () => NOW });
    expect(sortSelect().value).toBe('name');
    expect(cardNames()).toEqual(['<img src=x onerror=alert(1)>', 'Alura', 'Bossa Nova']);
    const bossa = $$('.tstb-card').find((node) => node.textContent.includes('Bossa'));
    expect(bossa.querySelector('.tstb-card-meta').textContent).toBe('Vídeo há 2 dias');
  });

  it('reorders by the most recent, marks those without a date and remembers the choice', async () => {
    const store = withUploads();
    await open({ store, now: () => NOW });
    changeSelect(sortSelect(), 'recent');
    await flush();
    expect(cardNames()).toEqual(['<img src=x onerror=alert(1)>', 'Bossa Nova', 'Alura']);
    const alura = $$('.tstb-card').find((node) => node.textContent.includes('Alura'));
    expect(alura.querySelector('.tstb-card-meta').textContent).toBe('Sem vídeos recentes');
    expect((await store.load()).preferences.sortBy).toBe('recent');
  });

  it('opens in the saved order right away', async () => {
    await open({ store: withUploads({ preferences: { sortBy: 'recent' } }), now: () => NOW });
    expect(sortSelect().value).toBe('recent');
    expect(cardNames()[0]).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('interval between syncs', () => {
  it('right after a sync, the button is disabled with an explanation and re-enables on its own', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      vi.setSystemTime(10_000_000);
      // Recent sync in storage: opening doesn't trigger the automatic one.
      const fresh = createStore(createFakeStorageArea({ channels, categories, lastSyncedAt: Date.now(), uploadsSyncedAt: Date.now(), feedSyncedAt: Date.now() }));
      const coordinator = createSyncCoordinator(async () => 3, { cooldownMs: 60_000 });
      await openCategoriesPage({ store: fresh, sync: coordinator, now: Date.now, searchDelay: 0 });
      button('Sincronizar').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button('Sincronizar').disabled).toBe(true);
      expect(button('Sincronizar').title).toContain('Disponível novamente');

      await vi.advanceTimersByTimeAsync(60_000);
      expect(button('Sincronizar').disabled).toBe(false);
      expect(button('Sincronizar').hasAttribute('title')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opening the page during a sync already in progress shows "Sincronizando…" without starting another', async () => {
    let finish;
    const run = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    // The same clock as the page (now: () => 1_000), as in production, where both use Date.now.
    const coordinator = createSyncCoordinator(run, { cooldownMs: 0, now: () => 1_000 });
    coordinator.sync();
    await openCategoriesPage({ store, sync: coordinator, now: () => 1_000, searchDelay: 0 });
    expect(button('Sincronizando…').disabled).toBe(true);
    finish(1);
    await flush();
    expect(run).toHaveBeenCalledOnce();
    expect(button('Sincronizar').disabled).toBe(false);
  });
});

describe('isStale', () => {
  it('considers it stale without a sync or after one hour', () => {
    expect(isStale(null, 0)).toBe(true);
    expect(isStale(0, HOUR + 1)).toBe(true);
    expect(isStale(0, HOUR)).toBe(false);
  });
});
