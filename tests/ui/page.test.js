import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeCategoriesPage, isStale, OPEN_CLASS, openCategoriesPage, PAGE_ID } from '../../src/ui/page.js';
import { createStore } from '../../src/storage/store.js';
import { TOAST_ID } from '../../src/ui/components/feedback.js';
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
  document.body.innerHTML = '<ytd-page-manager><ytd-browse id="home">Início</ytd-browse></ytd-page-manager>';
  document.documentElement.className = '';
  // O jsdom não implementa rolagem e polui a saída com avisos.
  window.scrollTo = vi.fn();
  // Sincronização recente: a maioria dos testes não deve disparar a sincronização automática.
  area = createFakeStorageArea({ channels, categories, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 });
  store = createStore(area);
});

const page = () => document.getElementById(PAGE_ID);
const $ = (selector) => page().querySelector(selector);
const $$ = (selector) => [...page().querySelectorAll(selector)];
const chip = (label) => $$('.tstb-chip').find((node) => node.querySelector('.tstb-chip-label')?.textContent === label);
const button = (label) => $$('button').find((node) => node.textContent.trim() === label);
const cardNames = () => $$('.tstb-card-name').map((node) => node.textContent);
const checkFor = (name) => $$('.tstb-check').find((node) => node.getAttribute('aria-label') === `Selecionar ${name}`);
// Ações gravam no storage de forma assíncrona; aguardamos a fila de tarefas esvaziar.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const open = (options = {}) => openCategoriesPage({ store, now: () => 1_000, searchDelay: 0, ...options });

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
    expect(card.querySelector('select').value).toBe('tech');
  });
});

describe('ordem alfabética das categorias', () => {
  const unordered = [
    { id: 'v', name: 'Viagem', channelIds: [] },
    { id: 't', name: 'Tech', channelIds: ['/@alura'] },
    { id: 'c', name: 'Comida', channelIds: [] },
  ];
  const optionLabels = (select) => [...select.options].map((option) => option.textContent);

  it('chips, pílulas e "Mover para…" usam a mesma ordem A–Z', async () => {
    await open({ store: createStore(createFakeStorageArea({ channels, categories: unordered, lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 })) });
    expect($$('.tstb-chips [data-chip-id]:not(.tstb-chip-all):not(.tstb-chip-pending) .tstb-chip-label').map((node) => node.textContent)).toEqual(['Comida', 'Tech', 'Viagem']);
    expect(optionLabels($('.tstb-pill'))).toEqual(['Sem categoria', 'Comida', 'Tech', 'Viagem']);
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
    area = createFakeStorageArea({ channels, categories: [{ id: 'v', name: 'Vazia', channelIds: [] }], lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 });
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
    changeSelect(card.querySelector('select'), 'tech');
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

  it('renomear uma categoria invalida os cartões (as opções do select mudam)', async () => {
    await open();
    const alura = cardOf('Alura');
    chip('Tech').click();
    $('.tstb-title-edit').click();
    $('.tstb-rename-input').value = 'Tecnologia';
    $('.tstb-rename-input').closest('form').requestSubmit();
    await flush();
    expect(cardOf('Alura')).not.toBe(alura);
    expect(cardOf('Alura').querySelector('option[value="tech"]').textContent).toBe('Tecnologia');
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

describe('sincronização', () => {
  it('sincroniza automaticamente quando a última sincronização é antiga', async () => {
    const sync = vi.fn(async () => store.replaceChannels(Object.values(channels), 2 * HOUR));
    await open({ sync, now: () => 1_000 + 2 * HOUR });
    await flush();
    expect(sync).toHaveBeenCalledOnce();
    expect($('.tstb-subtitle').textContent).toBe('3 inscrições · Sincronizado agora');
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
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 })), sync });
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
    expect(fileName).toBe('inscricoes-youtube-2026-11-22.csv');
    expect(csv.trim().split('\r\n')).toHaveLength(4);
    expect(csv).toContain('Alura,Tech,https://www.youtube.com/@alura,/@alura');
    expect(document.getElementById(TOAST_ID).textContent).toBe('3 inscrições exportadas');
  });

  it('fica desabilitado sem inscrições', async () => {
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 })) });
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
    expect($('.tstb-review-error').textContent).toContain('coluna "Categoria"');
    expect(button('Aplicar importação')).toBeUndefined();
    button('Fechar').click();
    expect($('.tstb-review')).toBeNull();
  });

  it('avisa quando nenhuma linha corresponde às inscrições', async () => {
    await importFile(fakeFile('Identificador,Categoria\r\n/@ninguem,Tech'));
    expect($('.tstb-review-error').textContent).toContain('Nenhuma linha do arquivo corresponde');
  });

  it('recusa arquivos grandes demais sem lê-los', async () => {
    const text = vi.fn();
    await importFile({ name: 'video.mp4', size: 50 * 1024 * 1024, text });
    expect($('.tstb-review-error').textContent).toContain('grande demais');
    expect(text).not.toHaveBeenCalled();
  });

  it('fica desabilitado sem inscrições', async () => {
    await open({ store: createStore(createFakeStorageArea({ lastSyncedAt: 1_000, uploadsSyncedAt: 1_000 })) });
    expect(button('Importar CSV').disabled).toBe(true);
  });
});

describe('ordenar por vídeo mais recente', () => {
  const NOW = 10 * 24 * 3_600_000;
  const withUploads = (extra = {}) =>
    createStore(createFakeStorageArea({ channels, categories, lastSyncedAt: NOW, uploadsSyncedAt: NOW, latestUploads: { '/@bossa': NOW - 2 * 24 * 3_600_000, '/@xss': NOW - 3_600_000 }, ...extra }));
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

describe('isStale', () => {
  it('considera antiga sem sincronização ou após uma hora', () => {
    expect(isStale(null, 0)).toBe(true);
    expect(isStale(0, HOUR + 1)).toBe(true);
    expect(isStale(0, HOUR)).toBe(false);
  });
});
