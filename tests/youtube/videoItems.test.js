import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseViewCount,
  shortFromLockup,
  shortThumbnail,
  shortsFromPage,
  thumbnailUrl,
  videoFromLockup,
  videoUrl,
  videosFromPage,
} from '../../src/youtube/videoItems.js';

// Real YouTube responses (Nov 2026), only without the menus. They validate the true format, not an
// imagined one.
// Path from the root: in the jsdom environment import.meta.url doesn't point to the file.
const fixture = (name) => JSON.parse(readFileSync(`tests/fixtures/youtube/${name}.json`, 'utf8'));
const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe('videosFromPage with real data', () => {
  it('reads the feed videos (with an author) with id, title, channel, date, duration and views', () => {
    const [first] = videosFromPage(fixture('feed-lockups'), NOW);
    expect(first).toEqual({
      videoId: 'rMaMe32qQkA',
      title: 'If you’ve deployed anything since 2015, I have bad news...',
      channelId: '/@Fireship',
      publishedAt: NOW - DAY,
      duration: '5:35',
      viewCount: 911_000,
    });
  });

  it('on a channel tab (no author in the metadata) uses the given channel', () => {
    const videos = videosFromPage(fixture('channel-video-lockups'), NOW, '/@Fireship');
    expect(videos.map((video) => [video.videoId, video.channelId, video.viewCount])).toEqual([
      ['rMaMe32qQkA', '/@Fireship', 921_000],
      ['Qxor6jpfSiU', '/@Fireship', 1_000_000],
    ]);
  });

  it('discards items without a channel when no channel is given', () => {
    expect(videosFromPage(fixture('channel-video-lockups'), NOW)).toEqual([]);
  });
});

describe('shortsFromPage with real data', () => {
  it('reads id, title and views of the Shorts (which carry no date)', () => {
    expect(shortsFromPage(fixture('channel-short-lockups'), '/@Fireship')).toEqual([
      { videoId: 'fwBIZRq-vzY', title: '5 life-changing Linux tips', channelId: '/@Fireship', viewCount: 1_700_000, thumbnail: expect.stringMatching(/^https:\/\/i\.ytimg\.com\/vi\/fwBIZRq-vzY\/oardefault\.jpg\?/) },
      { videoId: 'oRBvLbdMKM0', title: 'This rubber duck can debug your code', channelId: '/@Fireship', viewCount: 490_000, thumbnail: expect.stringMatching(/^https:\/\/i\.ytimg\.com\/vi\/oRBvLbdMKM0\/oar3\.jpg\?/) },
    ]);
  });

  it('uses the 9:16 vertical cover YouTube already sized (405×720), not the 1080×1920 one', () => {
    const [first] = shortsFromPage(fixture('channel-short-lockups'), '/@Fireship');
    const sources = fixture('channel-short-lockups').items[0].shortsLockupViewModel.thumbnailViewModel.thumbnailViewModel.image.sources;
    expect(first.thumbnail).toBe(sources.find((source) => source.width === 405 && source.height === 720).url);
  });

  it('ignores covers outside i.ytimg.com', () => {
    const lockup = fixture('channel-short-lockups').items[0].shortsLockupViewModel;
    const hostile = structuredClone(lockup);
    for (const source of hostile.thumbnailViewModel.thumbnailViewModel.image.sources) source.url = 'https://evil.example/x.jpg';
    expect(shortFromLockup(hostile, '/@Fireship').thumbnail).toBeNull();
  });
});

describe('videoFromLockup', () => {
  const lockup = (extra = {}) => ({
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    contentId: 'abcdefghijk',
    metadata: { lockupMetadataViewModel: { title: { content: 'Título' }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: '3 days ago' } }] }] } } } },
    ...extra,
  });

  it("ignores playlists and other content that isn't a video", () => {
    expect(videoFromLockup(lockup({ contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' }), NOW, '/@x')).toBeNull();
  });

  it('ignores items without a date (premieres and live streams) and invalid ids', () => {
    const noDate = lockup();
    noDate.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text.content = 'Premieres in 2 hours';
    expect(videoFromLockup(noDate, NOW, '/@x')).toBeNull();
    expect(videoFromLockup(lockup({ contentId: 'curto' }), NOW, '/@x')).toBeNull();
  });
});

describe('parseViewCount', () => {
  it.each([
    ['921K views', 921_000],
    ['1.7M views', 1_700_000],
    ['2B views', 2_000_000_000],
    ['12,345 views', 12_345],
    ['911 thousand views', 911_000],
    ['1 view', 1],
    ['No views', null],
    ['', null],
  ])('%j → %s', (text, expected) => {
    expect(parseViewCount(text)).toBe(expected);
  });
});

describe('links and thumbnails', () => {
  it('builds video and Short URLs from the id', () => {
    expect(videoUrl('abcdefghijk')).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(videoUrl('abcdefghijk', 'short')).toBe('https://www.youtube.com/shorts/abcdefghijk');
    expect(thumbnailUrl('abcdefghijk')).toBe('https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg');
    expect(thumbnailUrl('abcdefghijk', 'short')).toBe('https://i.ytimg.com/vi/abcdefghijk/oar2.jpg');
  });

  it("the Short's cover comes from the data; without it (old cache), falls back to the URL built from the id", () => {
    expect(shortThumbnail({ videoId: 'abcdefghijk', thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/oar3.jpg?sqp=x' })).toBe('https://i.ytimg.com/vi/abcdefghijk/oar3.jpg?sqp=x');
    expect(shortThumbnail({ videoId: 'abcdefghijk' })).toBe('https://i.ytimg.com/vi/abcdefghijk/oar2.jpg');
  });
});
