import { describe, expect, it } from 'vitest';
import { extractConfig, extractInitialData } from '../../src/youtube/pageData.js';
import { channelsPageHtml } from '../helpers/innertubeFixtures.js';

describe('extractInitialData', () => {
  it('reads the ytInitialData object from the HTML', () => {
    const html = channelsPageHtml({ a: 1, texto: '</script> não engana' });
    expect(extractInitialData(html)).toEqual({ a: 1, texto: '</script> não engana' });
  });

  it('returns null when there is no data or the JSON is invalid', () => {
    expect(extractInitialData('<html></html>')).toBeNull();
    expect(extractInitialData('<script>var ytInitialData = {quebrado};</script>')).toBeNull();
  });
});

describe('extractConfig', () => {
  it('reads the client version, key and session', () => {
    const html = channelsPageHtml({}, { SESSION_INDEX: 2, DELEGATED_SESSION_ID: '123' });
    expect(extractConfig(html)).toEqual({
      clientVersion: '2.20261120.00.00',
      apiKey: 'KEY',
      sessionIndex: '2',
      delegatedSessionId: '123',
    });
  });

  it('uses session 0 and no brand account by default', () => {
    const config = extractConfig('<html></html>');
    expect(config.sessionIndex).toBe('0');
    expect(config.delegatedSessionId).toBeNull();
  });
});
