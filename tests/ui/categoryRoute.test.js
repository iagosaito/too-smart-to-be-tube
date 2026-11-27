import { describe, expect, it } from 'vitest';
import { routeFromUrl, urlForView } from '../../src/ui/categoryRoute.js';

const YT = 'https://www.youtube.com';

describe('routeFromUrl', () => {
  it('lê a categoria e a aba da URL de Categorias', () => {
    expect(routeFromUrl(`${YT}/feed/subscriptions#tstb=prog&tab=shorts`)).toEqual({ filter: 'prog', tab: 'shorts' });
  });

  it('sem aba na URL abre em Vídeos, e uma aba desconhecida também', () => {
    expect(routeFromUrl(`${YT}/feed/subscriptions#tstb=all`)).toEqual({ filter: 'all', tab: 'videos' });
    expect(routeFromUrl(`${YT}/feed/subscriptions#tstb=prog&tab=lixo`)).toEqual({ filter: 'prog', tab: 'videos' });
  });

  it('qualquer outra página do YouTube não é uma rota de Categorias', () => {
    expect(routeFromUrl(`${YT}/feed/subscriptions`)).toBeNull();
    expect(routeFromUrl(`${YT}/watch?v=abc#tstb=prog`)).toBeNull();
    // The query form is not a route: YouTube erases it from the address right after loading.
    expect(routeFromUrl(`${YT}/feed/subscriptions?tstb=prog`)).toBeNull();
    expect(routeFromUrl(`${YT}/`)).toBeNull();
  });
});

describe('urlForView', () => {
  it('monta a URL a partir de qualquer página e omite a aba padrão', () => {
    expect(urlForView({ filter: 'prog', tab: 'videos' }, `${YT}/watch?v=abc#t=10`)).toBe(`${YT}/feed/subscriptions#tstb=prog`);
    expect(urlForView({ filter: 'prog', tab: 'channels' }, `${YT}/`)).toBe(`${YT}/feed/subscriptions#tstb=prog&tab=channels`);
  });

  it('ida e volta preservam ids com caracteres especiais', () => {
    const view = { filter: 'a b&c=d', tab: 'shorts' };
    expect(routeFromUrl(urlForView(view, `${YT}/`))).toEqual(view);
  });
});
