import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseViewCount,
  shortsFromPage,
  thumbnailUrl,
  videoFromLockup,
  videoUrl,
  videosFromPage,
} from '../../src/youtube/videoItems.js';

// Respostas reais do YouTube (nov/2026), só sem os menus. Validam o formato
// verdadeiro, não um formato imaginado.
// Caminho a partir da raiz: no ambiente jsdom import.meta.url não aponta para o arquivo.
const fixture = (name) => JSON.parse(readFileSync(`tests/fixtures/youtube/${name}.json`, 'utf8'));
const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe('videosFromPage com dados reais', () => {
  it('lê os vídeos do feed (com autor) com id, título, canal, data, duração e visualizações', () => {
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

  it('na aba de um canal (sem autor nos metadados) usa o canal informado', () => {
    const videos = videosFromPage(fixture('channel-video-lockups'), NOW, '/@Fireship');
    expect(videos.map((video) => [video.videoId, video.channelId, video.viewCount])).toEqual([
      ['rMaMe32qQkA', '/@Fireship', 921_000],
      ['Qxor6jpfSiU', '/@Fireship', 1_000_000],
    ]);
  });

  it('descarta itens sem canal quando nenhum canal é informado', () => {
    expect(videosFromPage(fixture('channel-video-lockups'), NOW)).toEqual([]);
  });
});

describe('shortsFromPage com dados reais', () => {
  it('lê id, título e visualizações dos Shorts (que não trazem data)', () => {
    expect(shortsFromPage(fixture('channel-short-lockups'), '/@Fireship')).toEqual([
      { videoId: 'fwBIZRq-vzY', title: '5 life-changing Linux tips', channelId: '/@Fireship', viewCount: 1_700_000 },
      { videoId: 'oRBvLbdMKM0', title: 'This rubber duck can debug your code', channelId: '/@Fireship', viewCount: 490_000 },
    ]);
  });
});

describe('videoFromLockup', () => {
  const lockup = (extra = {}) => ({
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    contentId: 'abcdefghijk',
    metadata: { lockupMetadataViewModel: { title: { content: 'Título' }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: '3 days ago' } }] }] } } } },
    ...extra,
  });

  it('ignora playlists e outros conteúdos que não são vídeo', () => {
    expect(videoFromLockup(lockup({ contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' }), NOW, '/@x')).toBeNull();
  });

  it('ignora itens sem data (estreias e lives) e ids inválidos', () => {
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

describe('links e miniaturas', () => {
  it('monta URLs de vídeo e de Short a partir do id', () => {
    expect(videoUrl('abcdefghijk')).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(videoUrl('abcdefghijk', 'short')).toBe('https://www.youtube.com/shorts/abcdefghijk');
    expect(thumbnailUrl('abcdefghijk')).toBe('https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg');
    expect(thumbnailUrl('abcdefghijk', 'short')).toBe('https://i.ytimg.com/vi/abcdefghijk/oar2.jpg');
  });
});
