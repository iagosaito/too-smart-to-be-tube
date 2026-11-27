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
  it('reads the columns by name, ignoring case and accents', () => {
    const { entries } = readImport([['IDENTIFICADOR', 'categoria'], ['/@a', 'Tech']]);
    expect(entries).toEqual([{ id: '/@a', url: '', name: '', category: 'Tech' }]);
  });

  it('accepts English headers', () => {
    expect(readImport([['Channel', 'Category'], ['Alura', 'Tech']]).entries[0]).toMatchObject({ name: 'Alura', category: 'Tech' });
  });

  it('"Sem categoria" and empty become an empty category', () => {
    expect(entriesOf(['A', 'Sem Categoria', '', '/@a'], ['B', '  ', '', '/@b']).map((e) => e.category)).toEqual(['', '']);
  });

  it("undoes the export's formula protection", () => {
    expect(entriesOf(["'=Canal", "'+Mais", '', '/@a'])[0]).toMatchObject({ name: '=Canal', category: '+Mais' });
  });

  it.each([
    [[['Channel', 'URL'], ['A', 'x']], 'import.missingCategory'],
    [[['Category', 'Other'], ['Tech', 'x']], 'import.missingIdentifier'],
    [[HEADER], 'import.noRows'],
    [[], 'import.missingCategory'],
  ])('explains the error when something is missing', (rows, message) => {
    expect(readImport(rows).error).toBe(message);
  });
});

describe('planImport', () => {
  it('creates new categories, moves channels and counts the impact', () => {
    const { categories, summary } = planImport(state, entriesOf(['', 'Música', '', '/@b'], ['', 'Tech', '', '/@a'], ['', 'Comida', '', '/@c']));
    expect(categories.map((c) => [c.name, c.channelIds])).toEqual([['Tech', ['/@a']], ['Música', ['/@b']], ['Comida', ['/@c']]]);
    expect(summary).toEqual({ matched: 3, moved: 2, created: ['Música', 'Comida'], unknown: [], categoryCount: 3 });
  });

  it('reuses an existing category, ignoring accents and case', () => {
    const { categories, summary } = planImport(state, entriesOf(['', 'TECH', '', '/@b']));
    expect(categories).toHaveLength(1);
    expect(categories[0].channelIds).toEqual(['/@a', '/@b']);
    expect(summary.created).toEqual([]);
  });

  it('matches by identifier, then by URL and last by name', () => {
    const entries = entriesOf(['', 'X', '', '@b'], ['', 'X', 'https://www.youtube.com/@c/videos', ''], ['alura', 'X', '', '']);
    expect(planImport(state, entries).summary.matched).toBe(3);
  });

  it("lists channels that aren't in the subscriptions without applying them", () => {
    const { categories, summary } = planImport(state, entriesOf(['Desconhecido', 'Nova', '', '/@zzz']));
    expect(summary).toMatchObject({ matched: 0, unknown: ['Desconhecido'], created: [] });
    expect(categories).toBe(state.categories);
  });

  it('an empty category takes the channel out of its current category', () => {
    const { categories, summary } = planImport(state, entriesOf(['', '', '', '/@a']));
    expect(categories[0].channelIds).toEqual([]);
    expect(summary.moved).toBe(1);
  });

  it("a channel already in the right category doesn't count as moved; one outside the file doesn't change", () => {
    const { categories, summary } = planImport(state, entriesOf(['', 'Tech', '', '/@a']));
    expect(summary.moved).toBe(0);
    expect(categories[0].channelIds).toEqual(['/@a']);
  });

  it("repeated row: the last one wins, and going back to the original state doesn't count as moved", () => {
    const { summary } = planImport(state, entriesOf(['', 'Outra', '', '/@a'], ['', 'Tech', '', '/@a']));
    expect(summary).toMatchObject({ matched: 1, moved: 0 });
  });
});

// Regression: the import had no limits. A CSV with thousands of rows for the same channel created
// thousands of empty categories (saved forever), names could be any length and the plan had
// quadratic cost, freezing the tab on the review screen.
describe('import limits', () => {
  const many = (count, row) => Array.from({ length: count }, (_, index) => row(index));

  it('repeated rows for the same channel create only the category that counts (the last one)', () => {
    const { categories, summary } = planImport(state, entriesOf(...many(50, (i) => ['', `Cat ${i}`, '', '/@b'])));
    expect(categories.map((c) => c.name)).toEqual(['Tech', 'Cat 49']);
    expect(summary.created).toEqual(['Cat 49']);
  });

  it("doesn't limit the number of rows (the file size already does)", () => {
    const rows = [HEADER, ...many(60_000, (i) => ['', 'Tech', '', `/@c${i}`])];
    const { entries, error } = readImport(rows);
    expect(error).toBeNull();
    expect(entries).toHaveLength(60_000);
  });

  const withChannels = (count) => ({ channels: Object.fromEntries(many(count, (i) => [`/@c${i}`, channel(`c${i}`, `C${i}`)])), categories: [] });
  const oneCategoryEach = (count) => entriesOf(...many(count, (i) => ['', `Nova ${i}`, '', `/@c${i}`]));

  it(`accepts creating exactly ${MAX_NEW_CATEGORIES} new categories`, () => {
    const result = planImport(withChannels(MAX_NEW_CATEGORIES), oneCategoryEach(MAX_NEW_CATEGORIES));
    expect(result.summary.error).toBeUndefined();
    expect(result.categories).toHaveLength(MAX_NEW_CATEGORIES);
  });

  it(`rejects imports that would create more than ${MAX_NEW_CATEGORIES} new categories, changing nothing`, () => {
    const result = planImport(withChannels(MAX_NEW_CATEGORIES + 1), oneCategoryEach(MAX_NEW_CATEGORIES + 1));
    expect(result.summary.error).toBe('import.tooManyCategories');
    expect(result.categories).toEqual([]);
  });

  it("reuses the plan while the file and the state don't change", () => {
    const entries = entriesOf(['', 'Música', '', '/@b']);
    const first = cachedPlanImport(state, entries);
    expect(cachedPlanImport({ ...state }, entries)).toBe(first);
    const changed = cachedPlanImport({ ...state, categories: [] }, entries);
    expect(changed).not.toBe(first);
    // New categories get random ids: compare the summary, not the ids.
    expect(changed.summary).toEqual(planImport({ ...state, categories: [] }, entries).summary);
  });

  it('cuts long category names at the same limit as the UI (60 characters)', () => {
    const { categories } = planImport(state, entriesOf(['', 'x'.repeat(5_000), '', '/@b']));
    expect(categories[1].name).toBe('x'.repeat(60));
  });

  it('plans 20 thousand rows and hundreds of categories in acceptable time', () => {
    const channels = Object.fromEntries(many(1_000, (i) => [`/@c${i}`, channel(`c${i}`, `C${i}`)]));
    const entries = entriesOf(...many(20_000, (i) => ['', `Cat ${i % 150}`, '', `/@c${i % 1_000}`]));
    const start = performance.now();
    planImport({ channels, categories: [] }, entries);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
