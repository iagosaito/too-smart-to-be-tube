import { describe, expect, it } from 'vitest';
import { extractConfig, extractInitialData } from '../../src/youtube/pageData.js';
import { channelsPageHtml } from '../helpers/innertubeFixtures.js';

describe('extractInitialData', () => {
  it('lê o objeto ytInitialData do HTML', () => {
    const html = channelsPageHtml({ a: 1, texto: '</script> não engana' });
    expect(extractInitialData(html)).toEqual({ a: 1, texto: '</script> não engana' });
  });

  it('retorna null quando não há dados ou o JSON é inválido', () => {
    expect(extractInitialData('<html></html>')).toBeNull();
    expect(extractInitialData('<script>var ytInitialData = {quebrado};</script>')).toBeNull();
  });
});

describe('extractConfig', () => {
  it('lê versão do cliente, chave e sessão', () => {
    const html = channelsPageHtml({}, { SESSION_INDEX: 2, DELEGATED_SESSION_ID: '123' });
    expect(extractConfig(html)).toEqual({
      clientVersion: '2.20261120.00.00',
      apiKey: 'KEY',
      sessionIndex: '2',
      delegatedSessionId: '123',
    });
  });

  it('usa a sessão 0 e nenhuma conta de marca por padrão', () => {
    const config = extractConfig('<html></html>');
    expect(config.sessionIndex).toBe('0');
    expect(config.delegatedSessionId).toBeNull();
  });
});
