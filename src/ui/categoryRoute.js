import { FEED_TAB } from '../feed/categoryFeed.js';

// The Categories page is drawn over a YouTube page, so it has no address of its own. A fragment on
// a real YouTube page gives it one: refresh, Back/Forward and bookmarks then work.
// - /feed/subscriptions is the base because it exists for every logged-in user and its sidebar is
//   always there; the extension draws on top of it, as it does on any other page.
// - The fragment, not the query: YouTube's router drops unknown query parameters from the address
//   right after loading (checked on youtube.com), but keeps the fragment on load, refresh and
//   Back/Forward.
export const ROUTE_PATH = '/feed/subscriptions';
const VIEW_PARAM = 'tstb';
const TAB_PARAM = 'tab';
const TABS = new Set(Object.values(FEED_TAB));

// { filter, tab } for a Categories URL, or null for any other YouTube page.
export function routeFromUrl(href) {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.slice(1));
  const filter = params.get(VIEW_PARAM);
  if (url.pathname !== ROUTE_PATH || !filter) return null;
  const tab = params.get(TAB_PARAM);
  // An unknown tab (an old or edited link) falls back to the default instead of failing.
  return { filter, tab: TABS.has(tab) ? tab : FEED_TAB.VIDEOS };
}

export function urlForView({ filter, tab }, href) {
  const params = new URLSearchParams({ [VIEW_PARAM]: filter });
  // The default tab stays out of the URL, keeping the common link short.
  if (tab !== FEED_TAB.VIDEOS) params.set(TAB_PARAM, tab);
  const url = new URL(ROUTE_PATH, href);
  url.hash = params.toString();
  return url.href;
}
