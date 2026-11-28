import { describe, expect, it } from 'vitest';
import { mergeFeedItems } from '../../src/core/feedItems.js';

const video = (videoId, publishedAt, extra = {}) => ({ videoId, publishedAt, channelId: '/@a', ...extra });

describe('mergeFeedItems', () => {
  it('keeps the stored videos and adds the new ones on top', () => {
    const merged = mergeFeedItems([video('b', 20), video('a', 10)], [video('c', 30)], 10);
    expect(merged.map((item) => item.videoId)).toEqual(['c', 'b', 'a']);
  });

  it('a known video is replaced by its fresh copy', () => {
    const merged = mergeFeedItems([video('a', 10, { viewCount: 5 })], [video('a', 12, { viewCount: 50 })], 10);
    expect(merged).toEqual([video('a', 12, { viewCount: 50 })]);
  });

  it('past the limit, the oldest are dropped', () => {
    const merged = mergeFeedItems([video('b', 20), video('a', 10)], [video('c', 30)], 2);
    expect(merged.map((item) => item.videoId)).toEqual(['c', 'b']);
  });
});
