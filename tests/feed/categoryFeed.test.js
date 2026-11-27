import { describe, expect, it } from 'vitest';
import { categoryVideos, interleave, nextChannels, orderByActivity } from '../../src/feed/categoryFeed.js';

const channel = (id, ucid = `UC${id.padEnd(22, 'x')}`) => ({ id: `/@${id}`, name: id, ucid });
const video = (videoId, channelId, publishedAt) => ({ videoId, channelId, publishedAt, title: videoId });

describe('orderByActivity', () => {
  it('puts first the channels that published most recently; those without a date go last, by name', () => {
    const ordered = orderByActivity([channel('b'), channel('a'), channel('c'), channel('d')], { '/@c': 30, '/@a': 10 });
    expect(ordered.map((item) => item.name)).toEqual(['c', 'a', 'b', 'd']);
  });
});

describe('categoryVideos', () => {
  it('merges the feed and the per-channel batches for the category only, without repeats, newest to oldest', () => {
    const feed = [video('v1', '/@a', 30), video('v2', '/@z', 40), video('v3', '/@b', 10)];
    const extra = [[video('v1', '/@a', 30), video('v4', '/@a', 20)]];
    expect(categoryVideos(feed, ['/@a', '/@b'], extra).map((item) => item.videoId)).toEqual(['v1', 'v4', 'v3']);
  });
});

describe('interleave', () => {
  it('alternates one item from each list, keeping the order within each', () => {
    expect(interleave([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']])).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
    expect(interleave([])).toEqual([]);
  });
});

describe('nextChannels', () => {
  it('takes the next batch of channels not yet requested that have a ucid', () => {
    const ordered = [channel('a'), channel('b', undefined), channel('c'), channel('d')];
    ordered[1].ucid = undefined;
    expect(nextChannels(ordered, new Set(['/@a']), 2).map((item) => item.id)).toEqual(['/@c', '/@d']);
  });
});
