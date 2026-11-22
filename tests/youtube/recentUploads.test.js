import { describe, expect, it, vi } from 'vitest';
import { fetchLatestUploads, latestByChannel, parseFeedPage, parseRelativeTime } from '../../src/youtube/recentUploads.js';
import { channelsPageHtml, continuationItem, continuationResponse } from '../helpers/innertubeFixtures.js';

const NOW = 1_000_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Formato clássico do feed: videoRenderer com autor e publishedTimeText.
const videoRenderer = (handle, published, title = 'Um vídeo') => ({
  videoRenderer: {
    title: { runs: [{ text: title }] },
    navigationEndpoint: { watchEndpoint: { videoId: 'x' } },
    ownerText: { runs: [{ text: handle, navigationEndpoint: { browseEndpoint: { canonicalBaseUrl: `/@${handle}` } } }] },
    publishedTimeText: { simpleText: published },
  },
});

// Formato novo, copiado de uma página real do YouTube: lockupViewModel com a
// data abreviada no texto ("1d ago") e por extenso no accessibilityLabel.
const lockup = (handle, published, title = 'Outro vídeo', label = undefined) => ({
  lockupViewModel: {
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
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
  ])('converte %j', (text, expected) => {
    expect(parseRelativeTime(text, NOW)).toBe(expected);
  });

  it.each(['Premieres in 2 hours', 'Scheduled for 12/25', '1K views', ''])('ignora %j', (text) => {
    expect(parseRelativeTime(text, NOW)).toBeNull();
  });
});

describe('parseFeedPage', () => {
  it('lê canal e data nos dois formatos do feed', () => {
    const data = { contents: [videoRenderer('alura', '2 hours ago'), lockup('fireship', '3 days ago')] };
    expect(parseFeedPage(data, NOW)).toEqual([
      { channelId: '/@alura', publishedAt: NOW - 2 * HOUR },
      { channelId: '/@fireship', publishedAt: NOW - 3 * DAY },
    ]);
  });

  it('lê o formato real abreviado com o rótulo de acessibilidade', () => {
    const data = { contents: [lockup('Fireship', '1d ago', 'Some video', '1 day ago')] };
    expect(parseFeedPage(data, NOW)).toEqual([{ channelId: '/@Fireship', publishedAt: NOW - DAY }]);
  });

  it('nunca usa o título como data', () => {
    const data = { contents: [lockup('a', 'Scheduled', 'What I did 3 days ago'), videoRenderer('b', 'Premiere', '5 hours ago lol')] };
    expect(parseFeedPage(data, NOW)).toEqual([]);
  });

  it('descarta itens sem canal (ex.: Shorts sem autor)', () => {
    expect(parseFeedPage({ contents: [{ videoRenderer: { publishedTimeText: { simpleText: '1 day ago' } } }] }, NOW)).toEqual([]);
  });
});

describe('latestByChannel', () => {
  it('fica com a data mais recente de cada canal', () => {
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

  it('lê o feed em inglês, segue as continuações e junta por canal', async () => {
    const firstHtml = channelsPageHtml({ contents: [videoRenderer('a', '1 day ago'), continuationItem('T1')] });
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(textResponse(firstHtml))
      .mockResolvedValueOnce(jsonResponse(continuationResponse([videoRenderer('a', '5 days ago'), lockup('b', '2 weeks ago')])));

    const uploads = await fetchLatestUploads({ fetchFn, cookie: 'SAPISID=abc', now: NOW });

    expect(uploads).toEqual({ '/@a': NOW - DAY, '/@b': NOW - 14 * DAY });
    expect(fetchFn.mock.calls[0][0]).toBe('https://www.youtube.com/feed/subscriptions?hl=en');
    expect(JSON.parse(fetchFn.mock.calls[1][1].body).context.client.hl).toBe('en');
  });

  it('falha com mensagem clara quando o feed não pode ser lido', async () => {
    const fetchFn = vi.fn().mockResolvedValue(textResponse('<html>login</html>'));
    await expect(fetchLatestUploads({ fetchFn, cookie: '' })).rejects.toThrow('feed de inscrições');
  });
});
