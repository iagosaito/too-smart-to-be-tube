import { describe, expect, it } from 'vitest';
import { cachedPlanImport, MAX_NEW_CATEGORIES, planImport, readImport } from '../../src/import/categorizationImport.js';

const channel = (handle, name) => ({ id: `/@${handle}`, name, url: `https://www.youtube.com/@${handle}`, avatar: '' });
const state = {
  channels: { '/@a': channel('a', 'Alura'), '/@b': channel('b', 'Bossa Nova'), '/@c': channel('c', 'Cozinha') },
  categories: [{ id: 'tech', name: 'Tech', channelIds: ['/@a'] }],
};
const HEADER = ['Canal', 'Categoria', 'URL', 'Identificador'];
const entriesOf = (...rows) => readImport([HEADER, ...rows]).entries;

describe('readImport', () => {
  it('lê as colunas pelo nome, sem ligar para maiúsculas e acentos', () => {
    const { entries } = readImport([['IDENTIFICADOR', 'categoria'], ['/@a', 'Tech']]);
    expect(entries).toEqual([{ id: '/@a', url: '', name: '', category: 'Tech' }]);
  });

  it('aceita cabeçalhos em inglês', () => {
    expect(readImport([['Channel', 'Category'], ['Alura', 'Tech']]).entries[0]).toMatchObject({ name: 'Alura', category: 'Tech' });
  });

  it('"Sem categoria" e vazio viram categoria vazia', () => {
    expect(entriesOf(['A', 'Sem Categoria', '', '/@a'], ['B', '  ', '', '/@b']).map((e) => e.category)).toEqual(['', '']);
  });

  it('desfaz a proteção contra fórmula da exportação', () => {
    expect(entriesOf(["'=Canal", "'+Mais", '', '/@a'])[0]).toMatchObject({ name: '=Canal', category: '+Mais' });
  });

  it.each([
    [[['Channel', 'URL'], ['A', 'x']], 'import.missingCategory'],
    [[['Category', 'Other'], ['Tech', 'x']], 'import.missingIdentifier'],
    [[HEADER], 'import.noRows'],
    [[], 'import.missingCategory'],
  ])('explica o erro quando falta algo', (rows, message) => {
    expect(readImport(rows).error).toBe(message);
  });
});

describe('planImport', () => {
  it('cria categorias novas, move canais e conta o impacto', () => {
    const { categories, summary } = planImport(state, entriesOf(['', 'Música', '', '/@b'], ['', 'Tech', '', '/@a'], ['', 'Comida', '', '/@c']));
    expect(categories.map((c) => [c.name, c.channelIds])).toEqual([['Tech', ['/@a']], ['Música', ['/@b']], ['Comida', ['/@c']]]);
    expect(summary).toEqual({ matched: 3, moved: 2, created: ['Música', 'Comida'], unknown: [], categoryCount: 3 });
  });

  it('reaproveita categoria existente ignorando acentos e maiúsculas', () => {
    const { categories, summary } = planImport(state, entriesOf(['', 'TECH', '', '/@b']));
    expect(categories).toHaveLength(1);
    expect(categories[0].channelIds).toEqual(['/@a', '/@b']);
    expect(summary.created).toEqual([]);
  });

  it('casa pelo identificador, depois pela URL e por último pelo nome', () => {
    const entries = entriesOf(['', 'X', '', '@b'], ['', 'X', 'https://www.youtube.com/@c/videos', ''], ['alura', 'X', '', '']);
    expect(planImport(state, entries).summary.matched).toBe(3);
  });

  it('lista canais que não estão nas inscrições sem aplicá-los', () => {
    const { categories, summary } = planImport(state, entriesOf(['Desconhecido', 'Nova', '', '/@zzz']));
    expect(summary).toMatchObject({ matched: 0, unknown: ['Desconhecido'], created: [] });
    expect(categories).toBe(state.categories);
  });

  it('categoria vazia tira o canal da categoria atual', () => {
    const { categories, summary } = planImport(state, entriesOf(['', '', '', '/@a']));
    expect(categories[0].channelIds).toEqual([]);
    expect(summary.moved).toBe(1);
  });

  it('canal já na categoria certa não conta como movido; fora do arquivo não muda', () => {
    const { categories, summary } = planImport(state, entriesOf(['', 'Tech', '', '/@a']));
    expect(summary.moved).toBe(0);
    expect(categories[0].channelIds).toEqual(['/@a']);
  });

  it('linha repetida: a última vence, e voltar ao estado original não conta como movido', () => {
    const { summary } = planImport(state, entriesOf(['', 'Outra', '', '/@a'], ['', 'Tech', '', '/@a']));
    expect(summary).toMatchObject({ matched: 1, moved: 0 });
  });
});

// Regressão: a importação não tinha limites. Um CSV com milhares de linhas
// para o mesmo canal criava milhares de categorias vazias (gravadas para
// sempre), os nomes podiam ter qualquer tamanho e o plano tinha custo
// quadrático, travando a aba na tela de revisão.
describe('limites da importação', () => {
  const many = (count, row) => Array.from({ length: count }, (_, index) => row(index));

  it('linhas repetidas do mesmo canal criam só a categoria que vale (a última)', () => {
    const { categories, summary } = planImport(state, entriesOf(...many(50, (i) => ['', `Cat ${i}`, '', '/@b'])));
    expect(categories.map((c) => c.name)).toEqual(['Tech', 'Cat 49']);
    expect(summary.created).toEqual(['Cat 49']);
  });

  it('não limita o número de linhas (o tamanho do arquivo já limita)', () => {
    const rows = [HEADER, ...many(60_000, (i) => ['', 'Tech', '', `/@c${i}`])];
    const { entries, error } = readImport(rows);
    expect(error).toBeNull();
    expect(entries).toHaveLength(60_000);
  });

  const withChannels = (count) => ({ channels: Object.fromEntries(many(count, (i) => [`/@c${i}`, channel(`c${i}`, `C${i}`)])), categories: [] });
  const oneCategoryEach = (count) => entriesOf(...many(count, (i) => ['', `Nova ${i}`, '', `/@c${i}`]));

  it(`aceita criar exatamente ${MAX_NEW_CATEGORIES} categorias novas`, () => {
    const result = planImport(withChannels(MAX_NEW_CATEGORIES), oneCategoryEach(MAX_NEW_CATEGORIES));
    expect(result.summary.error).toBeUndefined();
    expect(result.categories).toHaveLength(MAX_NEW_CATEGORIES);
  });

  it(`recusa importações que criariam mais de ${MAX_NEW_CATEGORIES} categorias novas, sem alterar nada`, () => {
    const result = planImport(withChannels(MAX_NEW_CATEGORIES + 1), oneCategoryEach(MAX_NEW_CATEGORIES + 1));
    expect(result.summary.error).toBe('import.tooManyCategories');
    expect(result.categories).toEqual([]);
  });

  it('reaproveita o plano enquanto arquivo e estado não mudam', () => {
    const entries = entriesOf(['', 'Música', '', '/@b']);
    const first = cachedPlanImport(state, entries);
    expect(cachedPlanImport({ ...state }, entries)).toBe(first);
    const changed = cachedPlanImport({ ...state, categories: [] }, entries);
    expect(changed).not.toBe(first);
    // Categorias novas ganham ids aleatórios: compara o resumo, não os ids.
    expect(changed.summary).toEqual(planImport({ ...state, categories: [] }, entries).summary);
  });

  it('corta nomes de categoria longos no mesmo limite da interface (60 caracteres)', () => {
    const { categories } = planImport(state, entriesOf(['', 'x'.repeat(5_000), '', '/@b']));
    expect(categories[1].name).toBe('x'.repeat(60));
  });

  it('planeja 20 mil linhas e centenas de categorias em tempo aceitável', () => {
    const channels = Object.fromEntries(many(1_000, (i) => [`/@c${i}`, channel(`c${i}`, `C${i}`)]));
    const entries = entriesOf(...many(20_000, (i) => ['', `Cat ${i % 150}`, '', `/@c${i % 1_000}`]));
    const start = performance.now();
    planImport({ channels, categories: [] }, entries);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
