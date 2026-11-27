import { describe, expect, it, vi } from 'vitest';
import { fetchLatestUploads, latestByChannel, parseFeedPage, parseRelativeTime } from '../../src/youtube/recentUploads.js';
import { channelsPageHtml, continuationItem, continuationResponse } from '../helpers/innertubeFixtures.js';

const NOW = 1_000_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Video ids are 11 characters long; derived from the data so they are stable and unique.
const fakeVideoId = (...parts) => parts.join('').replace(/[^\w-]/g, '').padEnd(11, 'x').slice(0, 11);

// Classic feed format: videoRenderer with author and publishedTimeText.
const videoRenderer = (handle, published, title = 'Um vídeo') => ({
  videoRenderer: {
    videoId: fakeVideoId(handle, published, title),
    title: { runs: [{ text: title }] },
    navigationEndpoint: { watchEndpoint: { videoId: 'x' } },
    ownerText: { runs: [{ text: handle, navigationEndpoint: { browseEndpoint: { canonicalBaseUrl: `/@${handle}` } } }] },
    publishedTimeText: { simpleText: published },
  },
});

// New format, copied from a real YouTube page: lockupViewModel with the abbreviated date in the
// text ("1d ago") and the spelled-out one in accessibilityLabel.
const lockup = (handle, published, title = 'Outro vídeo', label = undefined) => ({
  lockupViewModel: {
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    contentId: fakeVideoId(handle, published, title),
    metadata: {
      lockupMetadataViewModel: {
        title: { content: title },
        image: { decoratedAvatarViewModel: { rendererContext: { commandContext: { onTap: { innertubeCommand: { browseEndpoint: { canonicalBaseUrl: `/@${handle}` } } } } } } },
        metadata: {
          contentMetadataViewModel: {
            metadataRows: [{
              metadataParts: [
                { avatarStack: { avatarStackViewModel: { text: { content: handle } } } },
                { text: { content: '911K views' }, accessibilityLabel: '911 thousand views' },
                { text: { content: published }, ...(label ? { accessibilityLabel: label } : {}) },
              ],
            }],
          },
        },
      },
    },
  },
});

describe('parseRelativeTime', () => {
  it.each([
    ['3 hours ago', NOW - 3 * HOUR],
    ['Streamed 2 days ago', NOW - 2 * DAY],
    ['1 week ago', NOW - 7 * DAY],
    ['2 months ago', NOW - 60 * DAY],
    ['há 5 dias', NOW - 5 * DAY],
    ['1d ago', NOW - DAY],
    ['3h ago', NOW - 3 * HOUR],
    ['2w ago', NOW - 14 * DAY],
    ['1mo ago', NOW - 30 * DAY],
    ['5m ago', NOW - 5 * 60_000],
    ['2y ago', NOW - 730 * DAY],
    ['Transmitido há 1 mês', NOW - 30 * DAY],
    ['há 2 meses', NOW - 60 * DAY],
  ])('converts %j', (text, expected) => {
    expect(parseRelativeTime(text, NOW)).toBe(expected);
  });

  it.each(['Premieres in 2 hours', 'Scheduled for 12/25', '1K views', ''])('ignores %j', (text) => {
    expect(parseRelativeTime(text, NOW)).toBeNull();
  });
});

describe('parseFeedPage', () => {
  it('reads the channel and date in both feed formats', () => {
    const data = { contents: [videoRenderer('alura', '2 hours ago'), lockup('fireship', '3 days ago')] };
    expect(parseFeedPage(data, NOW)).toEqual([
      { channelId: '/@alura', publishedAt: NOW - 2 * HOUR },
      { channelId: '/@fireship', publishedAt: NOW - 3 * DAY },
    ]);
  });

  it('reads the real abbreviated format with the accessibility label', () => {
    const data = { contents: [lockup('Fireship', '1d ago', 'Some video', '1 day ago')] };
    expect(parseFeedPage(data, NOW)).toEqual([{ channelId: '/@Fireship', publishedAt: NOW - DAY }]);
  });

  it('never uses the title as a date', () => {
    const data = { contents: [lockup('a', 'Scheduled', 'What I did 3 days ago'), videoRenderer('b', 'Premiere', '5 hours ago lol')] };
    expect(parseFeedPage(data, NOW)).toEqual([]);
  });

  it('discards items without a channel (e.g. Shorts without an author)', () => {
    expect(parseFeedPage({ contents: [{ videoRenderer: { publishedTimeText: { simpleText: '1 day ago' } } }] }, NOW)).toEqual([]);
  });
});

// Regression: the channel name comes before the date in metadataRows. A channel called "1 second
// ago" (or containing "5m ago") was read as the publish date and always stayed at the top of
// "Latest video".
describe('the channel name is not read as a date', () => {
  function lockupWithAuthorName(authorName, published) {
    const node = lockup('spoofer', published);
    const parts = node.lockupViewModel.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts;
    parts[0].avatarStack.avatarStackViewModel.text.content = authorName;
    return node;
  }

  it.each(['1 second ago', 'Canal 5m ago', 'há 1 minuto'])("a channel called %j keeps the video's real date", (authorName) => {
    expect(parseFeedPage({ contents: [lockupWithAuthorName(authorName, '3 days ago')] }, NOW)).toEqual([
      { channelId: '/@spoofer', publishedAt: NOW - 3 * DAY },
    ]);
  });
});

describe('latestByChannel', () => {
  it('keeps the most recent date of each channel', () => {
    const items = [
      { channelId: '/@a', publishedAt: 10 },
      { channelId: '/@a', publishedAt: 30 },
      { channelId: '/@b', publishedAt: 20 },
    ];
    expect(latestByChannel(items)).toEqual({ '/@a': 30, '/@b': 20 });
  });
});

describe('fetchLatestUploads', () => {
  const textResponse = (text) => ({ ok: true, text: async () => text });
  const jsonResponse = (json) => ({ ok: true, json: async () => json });

  it('reads the feed in English, follows the continuations and groups by channel', async () => {
    const firstHtml = channelsPageHtml({ contents: [videoRenderer('a', '1 day ago'), continuationItem('T1')] });
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(textResponse(firstHtml))
      .mockResolvedValueOnce(jsonResponse(continuationResponse([videoRenderer('a', '5 days ago'), lockup('b', '2 weeks ago')])));

    const uploads = await fetchLatestUploads({ fetchFn, cookie: 'SAPISID=abc', now: NOW });

    expect(uploads).toEqual({ '/@a': NOW - DAY, '/@b': NOW - 14 * DAY });
    expect(fetchFn.mock.calls[0][0]).toBe('https://www.youtube.com/feed/subscriptions?hl=en');
    expect(JSON.parse(fetchFn.mock.calls[1][1].body).context.client.hl).toBe('en');
  });

  it("fails with a clear message when the feed can't be read", async () => {
    const fetchFn = vi.fn().mockResolvedValue(textResponse('<html>login</html>'));
    await expect(fetchLatestUploads({ fetchFn, cookie: '' })).rejects.toMatchObject({ key: 'error.feedUnavailable' });
  });
});
