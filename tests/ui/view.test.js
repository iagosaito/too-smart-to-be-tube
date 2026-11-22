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
  it('remove acentos, espaços nas pontas e maiúsculas', () => {
    expect(normalizeText('  Música ÁGUA ')).toBe('musica agua');
  });
});

describe('visibleChannels', () => {
  it('"Todas" lista todos em ordem alfabética', () => {
    expect(names(visibleChannels(state, view()))).toEqual(['Animes', 'Code TV', 'Música Boa']);
  });

  it('filtra por categoria e por "Sem categoria"', () => {
    expect(names(visibleChannels(state, view({ filter: 'tech' })))).toEqual(['Code TV']);
    expect(names(visibleChannels(state, view({ filter: FILTER_NONE })))).toEqual(['Animes', 'Música Boa']);
  });

  it('busca ignorando acentos e maiúsculas, combinada com o filtro', () => {
    expect(names(visibleChannels(state, view({ query: 'MUSICA' })))).toEqual(['Música Boa']);
    expect(visibleChannels(state, view({ filter: 'tech', query: 'musica' }))).toEqual([]);
  });

  it('retorna lista vazia para categoria inexistente', () => {
    expect(visibleChannels(state, view({ filter: 'sumiu' }))).toEqual([]);
  });
});

describe('buildChips', () => {
  it('monta Todas, cada categoria e Sem categoria com contagens', () => {
    expect(buildChips(state)).toEqual([
      { id: FILTER_ALL, label: 'Todas', count: 3 },
      { id: 'tech', label: 'Tech', count: 1 },
      { id: 'empty', label: 'Vazia', count: 0 },
      { id: FILTER_NONE, label: 'Sem categoria', count: 2 },
    ]);
  });
});

describe('buildChips (ordem)', () => {
  it('lista as categorias em ordem alfabética, não de criação', () => {
    const categories = ['Viagem', 'Comida', 'Música'].map((name, i) => ({ id: String(i), name, channelIds: [] }));
    expect(buildChips({ channels: {}, categories }).map((chip) => chip.label)).toEqual(['Todas', 'Comida', 'Música', 'Viagem', 'Sem categoria']);
  });
});

describe('resolveFilter', () => {
  it('mantém filtros fixos e categorias existentes', () => {
    expect(resolveFilter(FILTER_NONE, state.categories)).toBe(FILTER_NONE);
    expect(resolveFilter('tech', state.categories)).toBe('tech');
  });

  it('volta para "Todas" se a categoria não existe mais', () => {
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
  ])('com %s ms de diferença mostra "%s"', (elapsed, expected) => {
    const now = 1_000_000_000;
    expect(formatSyncInfo(elapsed == null ? null : now - elapsed, now)).toBe(expected);
  });
});

describe('sortChannels', () => {
  const channels = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }];

  it('em A–Z mantém a ordem recebida', () => {
    expect(sortChannels(channels, SORT_NAME, { d: 99 })).toBe(channels);
  });

  it('por recência: mais novo primeiro, sem data no fim em ordem alfabética', () => {
    const sorted = sortChannels(channels, SORT_RECENT, { c: 30, a: 10 });
    expect(sorted.map((c) => c.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('é aplicado por visibleChannels junto com filtro e busca', () => {
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

  it('remove da seleção o que não está visível', () => {
    expect([...pruneSelection(new Set(['a', 'x']), visible)]).toEqual(['a']);
  });

  it('devolve o mesmo Set quando nada muda', () => {
    const selected = new Set(['a', 'b']);
    expect(pruneSelection(selected, visible)).toBe(selected);
  });
});
