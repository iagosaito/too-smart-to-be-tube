import { describe, expect, it } from 'vitest';
import { csvFileName, subscriptionRows, subscriptionsCsv } from '../../src/export/subscriptionsCsv.js';

const channel = (handle, name) => ({ id: `/@${handle}`, name, url: `https://www.youtube.com/@${handle}`, avatar: '' });
const state = {
  channels: {
    '/@z': channel('z', 'Zeta'),
    '/@a': channel('a', 'Alfa'),
    '/@m': channel('m', 'Música'),
    '/@b': channel('b', 'Beta'),
  },
  categories: [
    { id: 'tech', name: 'Tech', channelIds: ['/@z', '/@a', '/@sumiu'] },
    { id: 'music', name: 'Música', channelIds: ['/@m'] },
  ],
};

describe('subscriptionRows', () => {
  it('cabeçalho em inglês, categorias na ordem do usuário, nomes em ordem e sem categoria no fim', () => {
    expect(subscriptionRows(state)).toEqual([
      ['Channel', 'Category', 'URL', 'Identifier'],
      ['Alfa', 'Tech', 'https://www.youtube.com/@a', '/@a'],
      ['Zeta', 'Tech', 'https://www.youtube.com/@z', '/@z'],
      ['Música', 'Música', 'https://www.youtube.com/@m', '/@m'],
      ['Beta', '', 'https://www.youtube.com/@b', '/@b'],
    ]);
  });

  it('ignora ids de canais que não existem mais e não perde nenhum canal', () => {
    const rows = subscriptionRows(state).slice(1);
    expect(rows).toHaveLength(Object.keys(state.channels).length);
    expect(rows.flat()).not.toContain('/@sumiu');
  });

  it('só cabeçalho quando não há inscrições', () => {
    expect(subscriptionRows({ channels: {}, categories: [] })).toHaveLength(1);
  });
});

describe('subscriptionsCsv', () => {
  it('gera o texto CSV final', () => {
    const csv = subscriptionsCsv({ channels: { '/@a': channel('a', 'Alfa') }, categories: [] });
    expect(csv).toBe('\uFEFFChannel,Category,URL,Identifier\r\nAlfa,,https://www.youtube.com/@a,/@a\r\n');
  });
});

describe('csvFileName', () => {
  it('usa a data local no formato AAAA-MM-DD', () => {
    expect(csvFileName(new Date(2026, 0, 5, 23, 30).getTime())).toBe('youtube-subscriptions-2026-01-05.csv');
  });
});
