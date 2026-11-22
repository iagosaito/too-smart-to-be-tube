import { describe, expect, it } from 'vitest';
import { categoryVideos, interleave, nextChannels, orderByActivity } from '../../src/feed/categoryFeed.js';

const channel = (id, ucid = `UC${id.padEnd(22, 'x')}`) => ({ id: `/@${id}`, name: id, ucid });
const video = (videoId, channelId, publishedAt) => ({ videoId, channelId, publishedAt, title: videoId });

describe('orderByActivity', () => {
  it('coloca primeiro os canais que publicaram mais recentemente; sem data vão para o fim, por nome', () => {
    const ordered = orderByActivity([channel('b'), channel('a'), channel('c'), channel('d')], { '/@c': 30, '/@a': 10 });
    expect(ordered.map((item) => item.name)).toEqual(['c', 'a', 'b', 'd']);
  });
});

describe('categoryVideos', () => {
  it('junta feed e lotes por canal só da categoria, sem repetir, do mais novo ao mais antigo', () => {
    const feed = [video('v1', '/@a', 30), video('v2', '/@z', 40), video('v3', '/@b', 10)];
    const extra = [[video('v1', '/@a', 30), video('v4', '/@a', 20)]];
    expect(categoryVideos(feed, ['/@a', '/@b'], extra).map((item) => item.videoId)).toEqual(['v1', 'v4', 'v3']);
  });
});

describe('interleave', () => {
  it('alterna um item de cada lista, mantendo a ordem dentro de cada uma', () => {
    expect(interleave([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']])).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
    expect(interleave([])).toEqual([]);
  });
});

describe('nextChannels', () => {
  it('pega o próximo lote de canais ainda não pedidos e que têm ucid', () => {
    const ordered = [channel('a'), channel('b', undefined), channel('c'), channel('d')];
    ordered[1].ucid = undefined;
    expect(nextChannels(ordered, new Set(['/@a']), 2).map((item) => item.id)).toEqual(['/@c', '/@d']);
  });
});
