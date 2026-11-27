import { beforeEach, describe, expect, it } from 'vitest';
import { scrapeChannels, scrapeFeedChannels, scrapeGuideChannels } from '../../src/dom/scraper.js';
import { feedChannel, GUIDE_HTML } from '../helpers/youtubeFixtures.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('scrapeGuideChannels', () => {
  it('reads only the subscriptions section, including collapsed items', () => {
    document.body.innerHTML = GUIDE_HTML;
    expect(scrapeGuideChannels(document).map((c) => c.id)).toEqual(['/@alura', '/channel/UCabc', '/@escondido']);
  });

  it('doesn\'t include "Your channel" or links that aren\'t channels', () => {
    document.body.innerHTML = GUIDE_HTML;
    const ids = scrapeGuideChannels(document).map((c) => c.id);
    expect(ids).not.toContain('/channel/UCme');
    expect(ids).not.toContain('/feed/channels');
  });

  it('captures the name and avatar', () => {
    document.body.innerHTML = GUIDE_HTML;
    expect(scrapeGuideChannels(document)[0]).toMatchObject({ name: 'Alura', avatar: 'https://yt3.example/alura.jpg' });
  });

  it("returns an empty list when the menu hasn't loaded yet", () => {
    expect(scrapeGuideChannels(document)).toEqual([]);
  });
});

describe('scrapeFeedChannels', () => {
  it('reads the channels from the /feed/channels page', () => {
    document.body.innerHTML = feedChannel('/@um', 'Um') + feedChannel('/@dois', 'Dois');
    expect(scrapeFeedChannels(document)).toEqual([
      { id: '/@um', name: 'Um', url: 'https://www.youtube.com/@um', avatar: 'https://yt3.example/@um.jpg' },
      { id: '/@dois', name: 'Dois', url: 'https://www.youtube.com/@dois', avatar: 'https://yt3.example/@dois.jpg' },
    ]);
  });

  it('discards incomplete renderers', () => {
    document.body.innerHTML = '<ytd-channel-renderer></ytd-channel-renderer>';
    expect(scrapeFeedChannels(document)).toEqual([]);
  });
});

describe('scrapeChannels', () => {
  it('combines the sidebar and /feed/channels', () => {
    document.body.innerHTML = GUIDE_HTML + feedChannel('/@feed', 'Feed');
    expect(scrapeChannels(document).map((c) => c.id)).toContain('/@feed');
    expect(scrapeChannels(document)).toHaveLength(4);
  });
});
