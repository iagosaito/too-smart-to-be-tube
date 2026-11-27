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

describe('montagem', () => {
  it('monta a página dentro do ytd-page-manager e marca o html como aberto', async () => {
    await open();
    expect(page().parentElement.tagName).toBe('YTD-PAGE-MANAGER');
    expect(document.documentElement.classList.contains(OPEN_CLASS)).toBe(true);
  });

  it('cai no body quando não há ytd-page-manager', async () => {
    document.body.innerHTML = '';
    await open();
    expect(page().parentElement).toBe(document.body);
  });

  it('não monta duas páginas ao mesmo tempo', async () => {
    await open();
    await open();
    expect(document.querySelectorAll(`#${PAGE_ID}`)).toHaveLength(1);
  });

  it('closeCategoriesPage remove a página e a marcação, mesmo se chamado sem página', async () => {
    await open();
    closeCategoriesPage();
    expect(page()).toBeNull();
    expect(document.documentElement.classList.contains(OPEN_CLASS)).toBe(false);
    expect(() => closeCategoriesPage()).not.toThrow();
  });
});

describe('visão geral', () => {
  it('abre em "Todas" com todos os canais e o total no subtítulo', async () => {
    await open();
    expect(chip('Todas').getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toHaveLength(3);
    expect($('.tstb-subtitle').textContent).toBe('3 inscrições · Sincronizado agora');
  });

  it('mostra um chip por categoria com contagem', async () => {
    await open();
    expect(chip('Tech').querySelector('.tstb-chip-count').textContent).toBe('1');
    expect(chip('Sem categoria').querySelector('.tstb-chip-count').textContent).toBe('2');
  });

  it('renderiza nomes de canais como texto', async () => {
    await open();
    expect($('img[src="x"]')).toBeNull();
    expect(page().textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('cada cartão é um link para o canal e mostra a categoria atual', async () => {
    await open();
    const card = $$('.tstb-card').find((node) => node.textContent.includes('Alura'));
    expect(card.querySelector('a').href).toBe('https://www.youtube.com/@alura');
    expect(card.querySelector('.tstb-pill').textContent).toBe('Tech');
  });
});

describe('ordem alfabética das categorias', () => {
  const unordered = [
    { id: 'v', name: 'Viagem', channelIds: [] },
    { id: 't', name: 'Tech', channelIds: ['/@alura'] },
    { id: 'c', name: 'Comida', channelIds: [] },
  ];
  const optionLabels = (select) => [...select.options].map((option) => option.textContent);
  afterEach(() => closeCategoryMenu());

  it('chips, pílulas e "Mover para…" usam a mesma ordem A–Z', async () => {
    await open({ store: createStore(createFakeStorageArea({ channels, categories: unordered, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })) });
    expect($$('.tstb-chips [data-chip-id]:not(.tstb-chip-all):not(.tstb-chip-pending) .tstb-chip-label').map((node) => node.textContent)).toEqual(['Comida', 'Tech', 'Viagem']);
    $('.tstb-pill').click();
    expect(menuLabels()).toEqual(['Sem categoria', 'Comida', 'Tech', 'Viagem']);
    closeCategoryMenu();
    checkFor('Alura').click();
    expect(optionLabels($('.tstb-bulk-select'))).toEqual(['Mover para…', 'Comida', 'Tech', 'Viagem', 'Sem categoria']);
  });
});

describe('filtros e busca', () => {
  it('clicar num chip mostra só aquela categoria, com ferramentas de edição', async () => {
    await open();
    chip('Tech').click();
    expect(cardNames()).toEqual(['Alura']);
    expect($('.tstb-view-title').textContent).toBe('Tech · 1 canal');
    expect($('[aria-label="Renomear categoria Tech"]')).not.toBeNull();
  });

  it('a busca filtra mantendo o foco no campo', async () => {
    await open();
    const search = $('.tstb-search-input');
    search.focus();
    search.value = 'bossa';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect(cardNames()).toEqual(['Bossa Nova']);
    expect(document.activeElement).toBe($('.tstb-search-input'));
  });

  it('busca sem resultado mostra estado vazio com "Limpar busca"', async () => {
    await open();
    const search = $('.tstb-search-input');
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    await flush();
    expect($('.tstb-empty-state').textContent).toContain('Nenhum canal encontrado');
    button('Limpar busca').click();
    expect(cardNames()).toHaveLength(3);
  });

  it('categoria vazia oferece atalho para "Sem categoria"', async () => {
    area = createFakeStorageArea({ channels, categories: [{ id: 'v', name: 'Vazia', channelIds: [] }], lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 });
    await open({ store: createStore(area) });
    chip('Vazia').click();
    button('Ver canais sem categoria').click();
    expect(chip('Sem categoria').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('categorias', () => {
  it('cria pelo chip "Nova categoria" e já abre a categoria criada', async () => {
    await open();
    button('Nova categoria').click();
    const input = $('.tstb-chip-input');
    input.value = 'Música';
    input.closest('form').requestSubmit();
    await flush();
    expect(area.dump().categories.map((c) => c.name)).toEqual(['Tech', 'Música']);
    expect(chip('Música').getAttribute('aria-pressed')).toBe('true');
  });

  it('Esc cancela a criação e devolve o chip', async () => {
    await open();
    button('Nova categoria').click();
    $('.tstb-chip-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('.tstb-chip-input')).toBeNull();
    expect(button('Nova categoria')).toBeDefined();
  });

  it('renomeia no próprio título', async () => {
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

  it('separa a zona da categoria (nome e excluir) da zona da lista (ordenar)', async () => {
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

  it('"Todas" e "Sem categoria" não têm título editável nem excluir', async () => {
    await open();
    expect($('.tstb-title-edit')).toBeNull();
    expect($('[aria-label^="Excluir categoria"]')).toBeNull();
    chip('Sem categoria').click();
    expect($('.tstb-title-edit')).toBeNull();
  });

  it('cancelar a renomeação volta ao título', async () => {
    await open();
    chip('Tech').click();
    $('.tstb-title-edit').click();
    button('Cancelar').click();
    expect($('.tstb-rename-input')).toBeNull();
  });

  it('exclui após confirmação, volta para "Todas" e avisa', async () => {
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

  it('não exclui se o usuário cancelar a confirmação', async () => {
    await open({ confirm: () => false });
    chip('Tech').click();
    $('[aria-label="Excluir categoria Tech"]').click();
    await flush();
    expect(area.dump().categories).toHaveLength(1);
  });

  it('move um canal pela pílula de categoria', async () => {
    await open();
    const card = $$('.tstb-card').find((node) => node.textContent.includes('Bossa'));
    chooseInMenu(card.querySelector('.tstb-pill'), 'Tech');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual(['/@alura', '/@bossa']);
  });
});

describe('desempenho', () => {
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));

  it('marcar um canal recria só o cartão dele; os outros são os mesmos nós', async () => {
    await open();
    const alura = cardOf('Alura');
    const bossa = cardOf('Bossa');
    checkFor('Bossa Nova').click();
    expect(cardOf('Alura')).toBe(alura);
    expect(cardOf('Bossa')).not.toBe(bossa);
  });

  it('a busca espera a pausa na digitação antes de redesenhar', async () => {
    await open({ searchDelay: 50 });
    const search = $('.tstb-search-input');
    search.value = 'bossa';
    search.dispatchEvent(new Event('input'));
    expect(cardNames()).toHaveLength(3);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cardNames()).toEqual(['Bossa Nova']);
  });

  it('renomear uma categoria invalida os cartões (as opções do menu mudam)', async () => {
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

describe('controle de categoria no cartão por visão', () => {
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));

  it('em "Todas" cada cartão mostra a pílula com a sua categoria', async () => {
    await open();
    expect(cardOf('Alura').querySelector('.tstb-pill').textContent).toBe('Tech');
    expect(cardOf('Alura').querySelector('.tstb-move')).toBeNull();
  });

  it('dentro de uma categoria não repete a pílula; oferece o ícone de mover', async () => {
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

  it('o ícone de mover tira o canal da categoria aberta', async () => {
    await open();
    chip('Tech').click();
    chooseInMenu(cardOf('Alura').querySelector('.tstb-move'), 'Sem categoria');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual([]);
    expect($('.tstb-empty-state').textContent).toContain('Categoria vazia');
  });

  it('em "Sem categoria" a pílula convida a escolher em vez de repetir "Sem categoria"', async () => {
    await open();
    chip('Sem categoria').click();
    const pill = cardOf('Bossa').querySelector('.tstb-pill');
    expect(pill.textContent).toBe('Escolher categoria…');
    chooseInMenu(pill, 'Tech');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual(['/@alura', '/@bossa']);
  });
});

describe('menu de categoria do cartão', () => {
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));

  it('clicar de novo na pílula fecha o menu sem mudar nada', async () => {
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

  it('escolher a categoria atual não grava nada', async () => {
    const set = vi.spyOn(area, 'set');
    await open();
    chooseInMenu(cardOf('Alura').querySelector('.tstb-pill'), 'Tech');
    await flush();
    expect(set).not.toHaveBeenCalled();
  });

  it('fechar a página de Categorias fecha o menu aberto', async () => {
    await open();
    cardOf('Alura').querySelector('.tstb-pill').click();
    closeCategoriesPage();
    expect(menu()).toBeNull();
  });
});

describe('seleção em lote', () => {
  it('marcar canais mostra a barra com a contagem', async () => {
    await open();
    checkFor('Bossa Nova').click();
    checkFor('Alura').click();
    expect($('.tstb-bulkbar').textContent).toContain('2 canais selecionados');
    expect($$('.tstb-card-selected')).toHaveLength(2);
  });

  it('no modo de seleção, clicar no cartão seleciona em vez de navegar', async () => {
    await open();
    checkFor('Alura').click();
    const link = $$('.tstb-card-link').find((node) => node.textContent.includes('Bossa'));
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect($('.tstb-bulkbar').textContent).toContain('2 canais selecionados');
  });

  it('move todos os selecionados de uma vez, limpa a seleção e avisa', async () => {
    await open();
    checkFor('Bossa Nova').click();
    checkFor('<img src=x onerror=alert(1)>').click();
    changeSelect($('.tstb-bulk-select'), 'tech');
    await flush();
    expect(area.dump().categories[0].channelIds).toEqual(['/@alura', '/@bossa', '/@xss']);
    expect($('.tstb-bulkbar')).toBeNull();
    expect(document.getElementById(TOAST_ID).textContent).toBe('2 canais movidos para "Tech"');
  });

  it('desmarcar e "Cancelar" limpam a seleção', async () => {
    await open();
    checkFor('Alura').click();
    checkFor('Alura').click();
    expect($('.tstb-bulkbar')).toBeNull();
    checkFor('Alura').click();
    button('Cancelar').click();
    expect($('.tstb-bulkbar')).toBeNull();
  });

  it('trocar de filtro limpa a seleção', async () => {
    await open();
    checkFor('Alura').click();
    chip('Tech').click();
    expect($('.tstb-bulkbar')).toBeNull();
  });
});

// Regression: selected channels that left the screen (moved individually or hidden by the search)
// stayed selected, invisible, and were moved along by the bulk action, undoing what the user had
// just done.
describe('seleção só contém o que está na tela', () => {
  const storeWith = (categoriesList) =>
    createStore(createFakeStorageArea({ channels, categories: categoriesList, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 }));
  const cardOf = (name) => $$('.tstb-card').find((node) => node.textContent.includes(name));
  const channelIdsOf = (id) => area.dump().categories.find((category) => category.id === id).channelIds;

  it('mover individualmente um canal selecionado o tira da seleção, e o lote não o move de novo', async () => {
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

  it('canais selecionados escondidos pela busca saem da seleção e não são movidos', async () => {
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

  it('a seleção visível continua intacta quando nada sai da tela', async () => {
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

describe('sincronização', () => {
  it('sincroniza automaticamente quando a última sincronização é antiga', async () => {
    const sync = vi.fn(async () => store.replaceChannels(Object.values(channels), 2 * HOUR));
    await open({ sync, now: () => 1_000 + 2 * HOUR });
    await flush();
    expect(sync).toHaveBeenCalledOnce();
    expect($('.tstb-subtitle').textContent).toBe('3 inscrições · Sincronizado agora');
  });

  it('numa aba em segundo plano, a sincronização automática espera a aba ficar visível', async () => {
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

  it('se outra aba sincronizou enquanto esta estava em segundo plano, não sincroniza de novo', async () => {
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

  it('uma página fechada em segundo plano não sincroniza quando a aba fica visível', async () => {
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

  it('mostra "Sincronizando…" e desabilita o botão enquanto roda', async () => {
    let finish;
    const sync = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    await open({ sync });
    button('Sincronizar').click();
    expect(button('Sincronizando…').disabled).toBe(true);
    finish();
    await flush();
    expect(button('Sincronizar').disabled).toBe(false);
  });

  it('mostra o erro no subtítulo quando a sincronização falha', async () => {
    const sync = vi.fn(async () => {
      throw new Error('você precisa estar logado no YouTube');
    });
    await open({ sync });
    button('Sincronizar').click();
    await flush();
    expect($('.tstb-error').textContent).toBe('3 inscrições · Falha ao sincronizar: você precisa estar logado no YouTube');
  });

  it('sem canais, o estado vazio oferece sincronizar', async () => {
    const sync = vi.fn(async () => 0);
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })), sync });
    expect($('.tstb-empty-state').textContent).toContain('Nenhuma inscrição ainda');
    button('Sincronizar inscrições').click();
    expect(sync).toHaveBeenCalledOnce();
  });

  it('esconde o botão quando não há função de sincronização', async () => {
    await open();
    expect(button('Sincronizar')).toBeUndefined();
  });
});

describe('exportar CSV', () => {
  it('baixa todas as inscrições, mesmo com filtro e busca ativos, e avisa', async () => {
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

  it('fica desabilitado sem inscrições', async () => {
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })) });
    expect(button('Exportar CSV').disabled).toBe(true);
  });
});

describe('importar CSV', () => {
  const fakeFile = (text, { name = 'categorias.csv', size = text.length } = {}) => ({ name, size, text: async () => text });
  const CSV = 'Canal,Categoria,URL,Identificador\r\nAlura,Tech,,/@alura\r\nBossa Nova,Música,,/@bossa\r\nFantasma,Nada,,/@fantasma\r\n';
  const importFile = async (file, options = {}) => {
    await open({ pickFile: async () => file, ...options });
    button('Importar CSV').click();
    await flush();
  };

  it('mostra a revisão com o impacto antes de aplicar, sem gravar nada', async () => {
    await importFile(fakeFile(CSV));
    const review = $('.tstb-review');
    expect(review.textContent).toContain('2 canais serão organizados em 2 categorias');
    expect(review.textContent).toContain('1 categoria nova: Música');
    expect(review.textContent).toContain('1 canal muda de categoria');
    expect(review.querySelector('details').textContent).toContain('Fantasma');
    expect(area.dump().categories).toEqual(categories);
    expect(document.activeElement).toBe(review.querySelector('h3'));
  });

  it('aplica, mostra o aviso com Desfazer e o Desfazer restaura a organização anterior', async () => {
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

  it('cancelar fecha a revisão sem gravar', async () => {
    await importFile(fakeFile(CSV));
    button('Cancelar').click();
    expect($('.tstb-review')).toBeNull();
    expect(area.dump().categories).toEqual(categories);
  });

  it('não faz nada se o usuário fechar o seletor sem escolher arquivo', async () => {
    await importFile(null);
    expect($('.tstb-review')).toBeNull();
  });

  it('explica o erro de formato e só oferece Fechar', async () => {
    await importFile(fakeFile('Nome,Outra\r\nA,B'));
    expect($('.tstb-review-error').textContent).toContain('coluna "Category"');
    expect(button('Aplicar importação')).toBeUndefined();
    button('Fechar').click();
    expect($('.tstb-review')).toBeNull();
  });

  it('avisa quando nenhuma linha corresponde às inscrições', async () => {
    await importFile(fakeFile('Identificador,Categoria\r\n/@ninguem,Tech'));
    expect($('.tstb-review-error').textContent).toContain('Nenhuma linha do arquivo corresponde');
  });

  it('mostra o erro e não deixa aplicar quando o arquivo criaria categorias demais', async () => {
    const rows = Array.from({ length: 1_001 }, (_, i) => `${i === 0 ? '/@alura' : `/@extra${i}`},Nova ${i}`);
    const many = Object.fromEntries(Array.from({ length: 1_001 }, (_, i) => [`/@extra${i}`, { id: `/@extra${i}`, name: `Extra ${i}`, url: '', avatar: '' }]));
    area = createFakeStorageArea({ channels: { ...channels, ...many }, categories, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 });
    await importFile(fakeFile(`Identifier,Category\r\n${rows.join('\r\n')}`), { store: createStore(area) });
    expect($('.tstb-review-error').textContent).toContain('mais de 1.000 categorias novas');
    expect(button('Aplicar importação')).toBeUndefined();
    expect(area.dump().categories).toEqual(categories);
  });

  it('aceita um arquivo com exatamente o tamanho máximo (5 MB)', async () => {
    await importFile(fakeFile(CSV, { size: 5 * 1024 * 1024 }));
    expect($('.tstb-review-error')).toBeNull();
    expect(button('Aplicar importação')).toBeDefined();
  });

  it('recusa, sem ler, um arquivo 1 byte acima do máximo', async () => {
    const text = vi.fn();
    await importFile({ name: 'grande.csv', size: 5 * 1024 * 1024 + 1, text });
    expect($('.tstb-review-error').textContent).toContain('grande demais');
    expect(text).not.toHaveBeenCalled();
  });

  it('recusa arquivos grandes demais sem lê-los', async () => {
    const text = vi.fn();
    await importFile({ name: 'video.mp4', size: 50 * 1024 * 1024, text });
    expect($('.tstb-review-error').textContent).toContain('grande demais');
    expect(text).not.toHaveBeenCalled();
  });

  it('fica desabilitado sem inscrições', async () => {
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000, feedSyncedAt: 1_000 })) });
    expect(button('Importar CSV').disabled).toBe(true);
  });
});

describe('ordenar por vídeo mais recente', () => {
  const NOW = 10 * 24 * 3_600_000;
  const withUploads = (extra = {}) =>
    createStore(createFakeStorageArea({ channels, categories, lastSyncedAt: NOW, uploadsSyncedAt: NOW, feedSyncedAt: NOW, latestUploads: { '/@bossa': NOW - 2 * 24 * 3_600_000, '/@xss': NOW - 3_600_000 }, ...extra }));
  const sortSelect = () => $('.tstb-sort-select');

  it('começa em A–Z e mostra a data do último vídeo no cartão', async () => {
    await open({ store: withUploads(), now: () => NOW });
    expect(sortSelect().value).toBe('name');
    expect(cardNames()).toEqual(['<img src=x onerror=alert(1)>', 'Alura', 'Bossa Nova']);
    const bossa = $$('.tstb-card').find((node) => node.textContent.includes('Bossa'));
    expect(bossa.querySelector('.tstb-card-meta').textContent).toBe('Vídeo há 2 dias');
  });

  it('reordena pelo mais recente, marca quem não tem data e lembra a escolha', async () => {
    const store = withUploads();
    await open({ store, now: () => NOW });
    changeSelect(sortSelect(), 'recent');
    await flush();
    expect(cardNames()).toEqual(['<img src=x onerror=alert(1)>', 'Bossa Nova', 'Alura']);
    const alura = $$('.tstb-card').find((node) => node.textContent.includes('Alura'));
    expect(alura.querySelector('.tstb-card-meta').textContent).toBe('Sem vídeos recentes');
    expect((await store.load()).preferences.sortBy).toBe('recent');
  });

  it('abre já na ordem salva', async () => {
    await open({ store: withUploads({ preferences: { sortBy: 'recent' } }), now: () => NOW });
    expect(sortSelect().value).toBe('recent');
    expect(cardNames()[0]).toBe('<img src=x onerror=alert(1)>');
  });

  it('sincroniza na hora quem ainda não tem datas de vídeos', async () => {
    const sync = vi.fn(async () => 3);
    await open({ store: withUploads({ uploadsSyncedAt: undefined }), sync, now: () => NOW });
    expect(sync).toHaveBeenCalledOnce();
  });
});

describe('intervalo entre sincronizações', () => {
  it('logo depois de sincronizar, o botão fica desabilitado com a explicação e reabilita sozinho', async () => {
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

  it('ao abrir a página durante uma sincronização já em andamento, mostra "Sincronizando…" sem iniciar outra', async () => {
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
  it('considera antiga sem sincronização ou após uma hora', () => {
    expect(isStale(null, 0)).toBe(true);
    expect(isStale(0, HOUR + 1)).toBe(true);
    expect(isStale(0, HOUR)).toBe(false);
  });
});
