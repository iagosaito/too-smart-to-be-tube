import { describe, expect, it } from 'vitest';
import {
  buildChips,
  FILTER_ALL,
  FILTER_NONE,
  formatSyncInfo,
  formatUploadAge,
  normalizeText,
  pruneSelection,
  resolveFilter,
  SORT_NAME,
  SORT_RECENT,
  sortChannels,
  visibleChannels,
} from '../../src/ui/view.js';

const state = {
  channels: {
    '/@a': { id: '/@a', name: 'Música Boa' },
    '/@b': { id: '/@b', name: 'Code TV' },
    '/@c': { id: '/@c', name: 'Animes' },
  },
  categories: [
    { id: 'tech', name: 'Tech', channelIds: ['/@b'] },
    { id: 'empty', name: 'Vazia', channelIds: [] },
  ],
};
const view = (changes = {}) => ({ filter: FILTER_ALL, query: '', ...changes });
const names = (channels) => channels.map((channel) => channel.name);

describe('normalizeText', () => {
  it('removes accents, surrounding spaces and case', () => {
    expect(normalizeText('  Música ÁGUA ')).toBe('musica agua');
  });
});

describe('visibleChannels', () => {
  it('"Todas" lists everyone in alphabetical order', () => {
    expect(names(visibleChannels(state, view()))).toEqual(['Animes', 'Code TV', 'Música Boa']);
  });

  it('filters by category and by "Sem categoria"', () => {
    expect(names(visibleChannels(state, view({ filter: 'tech' })))).toEqual(['Code TV']);
    expect(names(visibleChannels(state, view({ filter: FILTER_NONE })))).toEqual(['Animes', 'Música Boa']);
  });

  it('searches ignoring accents and case, combined with the filter', () => {
    expect(names(visibleChannels(state, view({ query: 'MUSICA' })))).toEqual(['Música Boa']);
    expect(visibleChannels(state, view({ filter: 'tech', query: 'musica' }))).toEqual([]);
  });

  it('returns an empty list for an unknown category', () => {
    expect(visibleChannels(state, view({ filter: 'sumiu' }))).toEqual([]);
  });
});

describe('buildChips', () => {
  it('builds Todas, each category and Sem categoria with counts', () => {
    expect(buildChips(state)).toEqual([
      { id: FILTER_ALL, label: 'Todas', count: 3 },
      { id: 'tech', label: 'Tech', count: 1 },
      { id: 'empty', label: 'Vazia', count: 0 },
      { id: FILTER_NONE, label: 'Sem categoria', count: 2 },
    ]);
  });
});

describe('buildChips (order)', () => {
  it('lists the categories in alphabetical order, not creation order', () => {
    const categories = ['Viagem', 'Comida', 'Música'].map((name, i) => ({ id: String(i), name, channelIds: [] }));
    expect(buildChips({ channels: {}, categories }).map((chip) => chip.label)).toEqual(['Todas', 'Comida', 'Música', 'Viagem', 'Sem categoria']);
  });
});

describe('resolveFilter', () => {
  it('keeps the fixed filters and existing categories', () => {
    expect(resolveFilter(FILTER_NONE, state.categories)).toBe(FILTER_NONE);
    expect(resolveFilter('tech', state.categories)).toBe('tech');
  });

  it('falls back to "Todas" if the category no longer exists', () => {
    expect(resolveFilter('sumiu', state.categories)).toBe(FILTER_ALL);
  });
});

describe('formatSyncInfo', () => {
  const MIN = 60_000;
  it.each([
    [null, 'Ainda não sincronizado'],
    [0, 'Sincronizado agora'],
    [5 * MIN, 'Sincronizado há 5 minutos'],
    [3 * 60 * MIN, 'Sincronizado há 3 horas'],
    [24 * 60 * MIN, 'Sincronizado ontem'],
    [72 * 60 * MIN, 'Sincronizado há 3 dias'],
  ])('with a %s ms difference shows "%s"', (elapsed, expected) => {
    const now = 1_000_000_000;
    expect(formatSyncInfo(elapsed == null ? null : now - elapsed, now)).toBe(expected);
  });
});

describe('sortChannels', () => {
  const channels = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }];

  it('in A–Z keeps the order received', () => {
    expect(sortChannels(channels, SORT_NAME, { d: 99 })).toBe(channels);
  });

  it('by recency: newest first, those without a date last in alphabetical order', () => {
    const sorted = sortChannels(channels, SORT_RECENT, { c: 30, a: 10 });
    expect(sorted.map((c) => c.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('is applied by visibleChannels along with the filter and search', () => {
    const state = { channels: { '/@x': { id: '/@x', name: 'Xis' }, '/@y': { id: '/@y', name: 'Ypsilon' } }, categories: [], latestUploads: { '/@y': 5 } };
    expect(visibleChannels(state, { filter: 'all', query: '', sort: SORT_RECENT }).map((c) => c.name)).toEqual(['Ypsilon', 'Xis']);
  });
});

describe('formatUploadAge', () => {
  const NOW = 1_000_000_000_000;
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  it.each([
    [null, null],
    [NOW - 10 * 60_000, 'Vídeo agora há pouco'],
    [NOW - 5 * HOUR, 'Vídeo há 5 horas'],
    [NOW - DAY, 'Vídeo ontem'],
    [NOW - 4 * DAY, 'Vídeo há 4 dias'],
    [NOW - 7 * DAY, 'Vídeo há 1 semana'],
    [NOW - 20 * DAY, 'Vídeo há 2 semanas'],
    [NOW - 45 * DAY, 'Vídeo há 1 mês'],
    [NOW - 100 * DAY, 'Vídeo há 3 meses'],
    [NOW - 800 * DAY, 'Vídeo há 2 anos'],
  ])('%s → %s', (publishedAt, expected) => {
    expect(formatUploadAge(publishedAt, NOW)).toBe(expected);
  });
});

describe('pruneSelection', () => {
  const visible = [{ id: 'a' }, { id: 'b' }];

  it("removes from the selection what isn't visible", () => {
    expect([...pruneSelection(new Set(['a', 'x']), visible)]).toEqual(['a']);
  });

  it('returns the same Set when nothing changes', () => {
    const selected = new Set(['a', 'b']);
    expect(pruneSelection(selected, visible)).toBe(selected);
  });
});
