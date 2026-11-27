import { FEED_TAB } from '../../feed/categoryFeed.js';
import { localeTag, plural, relativeTime, t } from '../../i18n/i18n.js';
import { shortThumbnail, thumbnailUrl, videoUrl } from '../../youtube/videoItems.js';
import { el, syncChildren } from '../elements.js';
import { renderEmptyState } from './feedback.js';
import { TABPANEL_ID } from './categoryTabs.js';

// A category's feed (videos or Shorts). The cards follow YouTube's grid: thumbnail first, title in
// up to two lines, channel and "views • time ago".

// Panel, list, footer and button are the same across renders (one of each per kind). On YouTube,
// recreating them took the list off the page for an instant and removed the focused button: on blur
// YouTube measured the layout with the page short, and the scroll jumped back to the top on every
// "Load more".
export function createFeedCardCache() {
  return { cards: new Map(), lists: {}, panels: {}, footers: {}, buttons: {}, actions: {} };
}

export function renderFeed({ tab, model, channelsById, now, cache, query }, actions) {
  const kind = tab === FEED_TAB.SHORTS ? 'short' : 'video';
  const items = filterByQuery(model.items, channelsById, query);
  const panel = cachedPanel(cache, kind);
  panel.setAttribute('aria-labelledby', `tstb-tab-${tab}`);
  panel.setAttribute('aria-busy', String(model.loading > 0));
  // The stable button always calls the actions of the latest render.
  cache.actions[kind] = actions;
  if (!items.length && !model.loading) {
    syncChildren(panel, [renderEmptyState(emptyStateFor(kind, model, actions, query))]);
    return panel;
  }
  const list = cachedList(cache, kind);
  syncChildren(list, [...items.map((item) => cachedCard(cache, item, kind, channelsById, now)), ...skeletons(kind, model, items.length)]);
  syncChildren(panel, [list, renderFooter(cache, kind, model, items.length)]);
  return panel;
}

function cachedPanel(cache, kind) {
  cache.panels[kind] ??= el('div', { className: 'tstb-feed', id: TABPANEL_ID, role: 'tabpanel' });
  return cache.panels[kind];
}

function filterByQuery(items, channelsById, query) {
  // The header search also applies to the feed: by title or channel name.
  const needle = query?.trim().toLocaleLowerCase();
  if (!needle) return items;
  return items.filter((item) => `${item.title} ${channelsById[item.channelId]?.name ?? ''}`.toLocaleLowerCase().includes(needle));
}

function cachedList(cache, kind) {
  // The same <ul> across renders: only new cards enter the DOM.
  cache.lists[kind] ??= el('ul', { className: kind === 'short' ? 'tstb-shorts-grid' : 'tstb-video-grid' });
  return cache.lists[kind];
}

function cachedCard(cache, item, kind, channelsById, now) {
  const channel = channelsById[item.channelId] ?? { name: '', url: '', avatar: '' };
  const label = kind === 'short' ? viewsLabel(item.viewCount) : metaLine(item, now);
  // Everything shown on the card goes into the key (including the language and "time ago").
  const key = [kind, item.title, channel.name, channel.avatar, label, localeTag()].join('\u0000');
  const cached = cache.cards.get(`${kind}:${item.videoId}`);
  if (cached?.key === key) return cached.node;
  const node = kind === 'short' ? renderShortCard(item, channel, label) : renderVideoCard(item, channel, label);
  cache.cards.set(`${kind}:${item.videoId}`, { key, node });
  return node;
}

function renderVideoCard(video, channel, meta) {
  const href = videoUrl(video.videoId);
  return el('li', { className: 'tstb-video' }, [
    // The thumbnail repeats the title's link: out of the Tab order so there aren't two identical
    // stops.
    el('a', { className: 'tstb-video-thumb', href, tabindex: '-1', 'aria-hidden': 'true' }, [
      el('img', { src: thumbnailUrl(video.videoId), alt: '', loading: 'lazy', decoding: 'async' }),
      video.duration ? el('span', { className: 'tstb-duration' }, video.duration) : null,
    ]),
    el('div', { className: 'tstb-video-details' }, [
      channel.avatar ? el('img', { className: 'tstb-video-avatar', src: channel.avatar, alt: '', loading: 'lazy', decoding: 'async' }) : null,
      el('div', { className: 'tstb-video-text' }, [
        el('h3', { className: 'tstb-video-title' }, el('a', { href, title: video.title }, video.title)),
        channel.url ? el('a', { className: 'tstb-video-channel', href: channel.url }, channel.name) : null,
        el('p', { className: 'tstb-video-meta' }, meta),
      ]),
    ]),
  ]);
}

function renderShortCard(short, channel, views) {
  return el('li', { className: 'tstb-short' }, [
    el('a', { className: 'tstb-short-link', href: videoUrl(short.videoId, 'short'), title: short.title }, [
      el('div', { className: 'tstb-short-thumb' }, el('img', { src: shortThumbnail(short), alt: '', loading: 'lazy', decoding: 'async' })),
      el('h3', { className: 'tstb-short-title' }, short.title),
      el('p', { className: 'tstb-short-meta' }, [channel.name, views].filter(Boolean).join(' • ')),
    ]),
  ]);
}

function metaLine(video, now) {
  // At least 1 minute: "0 minutes ago" would look like an error.
  const time = relativeTime(Math.max(now - video.publishedAt, 60_000));
  const views = viewsLabel(video.viewCount);
  return views ? t('feed.meta', { views, time }) : time;
}

function viewsLabel(count) {
  if (count == null) return '';
  // The language's compact format: "921 mil", "921K".
  const formatted = new Intl.NumberFormat(localeTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(count);
  return plural('feed.views', count, { formatted });
}

function skeletons(kind, model, shown) {
  // Skeletons in the exact shape of the grid while a batch loads (1–10 s): they hint at what's
  // coming without drawing attention to the wait (NN/g).
  if (!model.loading) return [];
  const count = shown ? 4 : kind === 'short' ? 12 : 8;
  return Array.from({ length: count }, () => el('li', { className: `tstb-skeleton tstb-skeleton-${kind}`, 'aria-hidden': 'true' }, [
    el('div', { className: 'tstb-skeleton-media' }),
    el('div', { className: 'tstb-skeleton-line' }),
    el('div', { className: 'tstb-skeleton-line tstb-skeleton-line-short' }),
  ]));
}

function renderFooter(cache, kind, model, shown) {
  const children = [];
  if (model.errorKey) children.push(el('p', { className: 'tstb-feed-error', role: 'alert' }, capitalize(t(model.errorKey))));
  if (model.missingIds) children.push(el('p', { className: 'tstb-hint' }, t('feed.missingIds')));
  // Explicit "Load more" (not infinite scroll): each click is a bounded batch of requests and the
  // footer stays reachable (NN/g, Baymard).
  if (model.hasMore && !model.loading) children.push(loadMoreButton(cache, kind));
  else if (!model.hasMore && !model.loading && shown) children.push(el('p', { className: 'tstb-feed-end' }, t('feed.end')));
  cache.footers[kind] ??= el('div', { className: 'tstb-feed-footer' });
  syncChildren(cache.footers[kind], children);
  return cache.footers[kind];
}

function loadMoreButton(cache, kind) {
  cache.buttons[kind] ??= el('button', { type: 'button', className: 'tstb-button tstb-load-more', onClick: () => cache.actions[kind].loadMore() });
  // The label follows the language, which may change between renders.
  const label = kind === 'short' ? t('feed.loadMoreShorts') : t('feed.loadOlder');
  if (cache.buttons[kind].textContent !== label) cache.buttons[kind].textContent = label;
  return cache.buttons[kind];
}

function emptyStateFor(kind, model, actions, query) {
  if (query) return { title: t('empty.noResults.title'), text: t('empty.noResults.text', { query }), action: { label: t('empty.noResults.action'), onClick: () => actions.search('') } };
  if (model.channelCount === 0) {
    return { title: t('feed.empty.noChannels.title'), text: t('feed.empty.noChannels.text'), action: { label: t('feed.empty.noChannels.action'), onClick: () => actions.setTab(FEED_TAB.CHANNELS) } };
  }
  const prefix = kind === 'short' ? 'feed.empty.shorts' : 'feed.empty.videos';
  const action = model.hasMore ? { label: kind === 'short' ? t('feed.loadMoreShorts') : t('feed.loadOlder'), onClick: actions.loadMore } : null;
  return { title: t(`${prefix}.title`), text: model.errorKey ? capitalize(t(model.errorKey)) : t(`${prefix}.text`), action };
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
