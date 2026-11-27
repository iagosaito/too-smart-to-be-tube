import { describe, expect, it } from 'vitest';
import { routeFromUrl, urlForView } from '../../src/ui/categoryRoute.js';

const YT = 'https://www.youtube.com';

describe('routeFromUrl', () => {
  it('reads the category and the tab from the Categories URL', () => {
    expect(routeFromUrl(`${YT}/feed/subscriptions#tstb=prog&tab=shorts`)).toEqual({ filter: 'prog', tab: 'shorts' });
  });

  it('without a tab in the URL opens on Videos, and an unknown tab too', () => {
    expect(routeFromUrl(`${YT}/feed/subscriptions#tstb=all`)).toEqual({ filter: 'all', tab: 'videos' });
    expect(routeFromUrl(`${YT}/feed/subscriptions#tstb=prog&tab=lixo`)).toEqual({ filter: 'prog', tab: 'videos' });
  });

  it('any other YouTube page is not a Categories route', () => {
    expect(routeFromUrl(`${YT}/feed/subscriptions`)).toBeNull();
    expect(routeFromUrl(`${YT}/watch?v=abc#tstb=prog`)).toBeNull();
    // The query form is not a route: YouTube erases it from the address right after loading.
    expect(routeFromUrl(`${YT}/feed/subscriptions?tstb=prog`)).toBeNull();
    expect(routeFromUrl(`${YT}/`)).toBeNull();
  });
});

describe('urlForView', () => {
  it('builds the URL from any page and leaves out the default tab', () => {
    expect(urlForView({ filter: 'prog', tab: 'videos' }, `${YT}/watch?v=abc#t=10`)).toBe(`${YT}/feed/subscriptions#tstb=prog`);
    expect(urlForView({ filter: 'prog', tab: 'channels' }, `${YT}/`)).toBe(`${YT}/feed/subscriptions#tstb=prog&tab=channels`);
  });

  it('round trips keep ids with special characters', () => {
    const view = { filter: 'a b&c=d', tab: 'shorts' };
    expect(routeFromUrl(urlForView(view, `${YT}/`))).toEqual(view);
  });
});
