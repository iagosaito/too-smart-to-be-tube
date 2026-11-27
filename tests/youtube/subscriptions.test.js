import { describe, expect, it, vi } from 'vitest';
import { fetchAllSubscriptions, findAll, parseChannelsPage, rendererToChannel } from '../../src/youtube/subscriptions.js';
import {
  channelRenderer,
  channelsPageHtml,
  continuationItem,
  continuationResponse,
  initialData,
} from '../helpers/innertubeFixtures.js';

const textResponse = (text) => ({ ok: true, text: async () => text });
const jsonResponse = (json) => ({ ok: true, json: async () => json });

describe('findAll', () => {
  it('finds the key at any depth, including in arrays', () => {
    const data = { a: [{ alvo: 1 }, { b: { alvo: 2 } }], alvo: 3 };
    expect(findAll(data, 'alvo').sort()).toEqual([1, 2, 3]);
  });

  it("doesn't descend into the value it found", () => {
    expect(findAll({ alvo: { alvo: 2 } }, 'alvo')).toEqual([{ alvo: 2 }]);
  });
});

describe('rendererToChannel', () => {
  it('converts using the handle, the largest avatar and an absolute URL', () => {
    expect(rendererToChannel(channelRenderer('alura', 'Alura').channelRenderer)).toEqual({
      id: '/@alura',
      name: 'Alura',
      url: 'https://www.youtube.com/@alura',
      avatar: 'https://yt3.example/alura.jpg',
    });
  });

  it('uses /channel/ID when the channel has no handle', () => {
    const renderer = channelRenderer('x', 'X', { withHandle: false }).channelRenderer;
    expect(rendererToChannel(renderer).id).toBe('/channel/UCx');
  });

  it('accepts titles in the runs format', () => {
    const renderer = { ...channelRenderer('x', 'X').channelRenderer, title: { runs: [{ text: 'Runs' }] } };
    expect(rendererToChannel(renderer).name).toBe('Runs');
  });
});

describe('parseChannelsPage', () => {
  it('extracts channels and the continuation token', () => {
    const page = parseChannelsPage(initialData([channelRenderer('a', 'A'), continuationItem('T1')]));
    expect(page.channels.map((c) => c.id)).toEqual(['/@a']);
    expect(page.token).toBe('T1');
  });

  it('returns a null token on the last page', () => {
    expect(parseChannelsPage(continuationResponse([channelRenderer('a', 'A')])).token).toBeNull();
  });
});

describe('fetchAllSubscriptions', () => {
  const firstHtml = channelsPageHtml(initialData([channelRenderer('a', 'A'), continuationItem('T1')]));

  function fakeFetch(...continuations) {
    const fetchFn = vi.fn().mockResolvedValueOnce(textResponse(firstHtml));
    continuations.forEach((page) => fetchFn.mockResolvedValueOnce(jsonResponse(page)));
    return fetchFn;
  }

  it('follows the continuation tokens up to the last page', async () => {
    const fetchFn = fakeFetch(
      continuationResponse([channelRenderer('b', 'B'), continuationItem('T2')]),
      continuationResponse([channelRenderer('c', 'C')]),
    );
    const channels = await fetchAllSubscriptions({ fetchFn, cookie: 'SAPISID=abc' });
    expect(channels.map((c) => c.id)).toEqual(['/@a', '/@b', '/@c']);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('sends the token and the client version in the continuation, authenticated', async () => {
    const fetchFn = fakeFetch(continuationResponse([]));
    await fetchAllSubscriptions({ fetchFn, cookie: 'SAPISID=abc' });
    const [url, init] = fetchFn.mock.calls[1];
    expect(url).toBe('https://www.youtube.com/youtubei/v1/browse?key=KEY&prettyPrint=false');
    expect(JSON.parse(init.body)).toMatchObject({ continuation: 'T1', context: { client: { clientVersion: '2.20261120.00.00' } } });
    expect(init.headers.Authorization).toMatch(/^SAPISIDHASH /);
  });

  it('removes duplicate channels across pages', async () => {
    const fetchFn = fakeFetch(continuationResponse([channelRenderer('a', 'A')]));
    expect(await fetchAllSubscriptions({ fetchFn, cookie: 'SAPISID=abc' })).toHaveLength(1);
  });

  it('fails when the first page has no subscriptions (logged out)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(textResponse('<html>login</html>'));
    await expect(fetchAllSubscriptions({ fetchFn, cookie: '' })).rejects.toMatchObject({ key: 'error.noSubscriptions' });
  });

  it('fails when the continuation responds with an HTTP error', async () => {
    const fetchFn = fakeFetch();
    fetchFn.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(fetchAllSubscriptions({ fetchFn, cookie: 'SAPISID=abc' })).rejects.toMatchObject({ key: 'error.http', params: { status: 401 } });
  });
});
