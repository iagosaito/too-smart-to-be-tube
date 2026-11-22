import { FEED_TAB } from '../../feed/categoryFeed.js';
import { localeTag, plural, relativeTime, t } from '../../i18n/i18n.js';
import { thumbnailUrl, videoUrl } from '../../youtube/videoItems.js';
import { el, syncChildren } from '../elements.js';
import { renderEmptyState } from './feedback.js';
import { TABPANEL_ID } from './categoryTabs.js';

// Feed de uma categoria (vídeos ou Shorts). Os cartões seguem a grade do
// YouTube: miniatura primeiro, título em até duas linhas, canal e
// "visualizações • há quanto tempo".

export function createFeedCardCache() {
  return { cards: new Map(), lists: {} };
}

export function renderFeed({ tab, model, channelsById, now, cache, query }, actions) {
  const kind = tab === FEED_TAB.SHORTS ? 'short' : 'video';
  const items = filterByQuery(model.items, channelsById, query);
  const panel = el('div', { className: 'tstb-feed', id: TABPANEL_ID, role: 'tabpanel', 'aria-labelledby': `tstb-tab-${tab}`, 'aria-busy': String(model.loading > 0) });
  if (!items.length && !model.loading) {
    panel.append(renderEmptyState(emptyStateFor(kind, model, actions, query)));
    return panel;
  }
  const list = cachedList(cache, kind);
  syncChildren(list, [...items.map((item) => cachedCard(cache, item, kind, channelsById, now)), ...skeletons(kind, model, items.length)]);
  panel.append(list, renderFooter(kind, model, actions, items.length));
  return panel;
}

function filterByQuery(items, channelsById, query) {
  // A busca do cabeçalho também vale no feed: por título ou nome do canal.
  const needle = query?.trim().toLocaleLowerCase();
  if (!needle) return items;
  return items.filter((item) => `${item.title} ${channelsById[item.channelId]?.name ?? ''}`.toLocaleLowerCase().includes(needle));
}

function cachedList(cache, kind) {
  // A mesma <ul> entre renders: só os cartões novos entram no DOM.
  cache.lists[kind] ??= el('ul', { className: kind === 'short' ? 'tstb-shorts-grid' : 'tstb-video-grid' });
  return cache.lists[kind];
}

function cachedCard(cache, item, kind, channelsById, now) {
  const channel = channelsById[item.channelId] ?? { name: '', url: '', avatar: '' };
  const label = kind === 'short' ? viewsLabel(item.viewCount) : metaLine(item, now);
  // Tudo o que aparece no cartão entra na chave (inclui idioma e "há quanto tempo").
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
    // A miniatura repete o link do título: fora da ordem do Tab para não haver duas paradas iguais.
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
      el('div', { className: 'tstb-short-thumb' }, el('img', { src: thumbnailUrl(short.videoId, 'short'), alt: '', loading: 'lazy', decoding: 'async' })),
      el('h3', { className: 'tstb-short-title' }, short.title),
      el('p', { className: 'tstb-short-meta' }, [channel.name, views].filter(Boolean).join(' • ')),
    ]),
  ]);
}

function metaLine(video, now) {
  // Mínimo de 1 minuto: "há 0 minutos" soaria como erro.
  const time = relativeTime(Math.max(now - video.publishedAt, 60_000));
  const views = viewsLabel(video.viewCount);
  return views ? t('feed.meta', { views, time }) : time;
}

function viewsLabel(count) {
  if (count == null) return '';
  // Formato compacto do idioma: "921 mil", "921K".
  const formatted = new Intl.NumberFormat(localeTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(count);
  return plural('feed.views', count, { formatted });
}

function skeletons(kind, model, shown) {
  // Esqueletos no formato exato da grade enquanto um lote carrega (1–10 s):
  // dão noção do que vem sem chamar atenção para a espera (NN/g).
  if (!model.loading) return [];
  const count = shown ? 4 : kind === 'short' ? 12 : 8;
  return Array.from({ length: count }, () => el('li', { className: `tstb-skeleton tstb-skeleton-${kind}`, 'aria-hidden': 'true' }, [
    el('div', { className: 'tstb-skeleton-media' }),
    el('div', { className: 'tstb-skeleton-line' }),
    el('div', { className: 'tstb-skeleton-line tstb-skeleton-line-short' }),
  ]));
}

function renderFooter(kind, model, actions, shown) {
  const children = [];
  if (model.errorKey) children.push(el('p', { className: 'tstb-feed-error', role: 'alert' }, capitalize(t(model.errorKey))));
  if (model.missingIds) children.push(el('p', { className: 'tstb-hint' }, t('feed.missingIds')));
  // "Carregar mais" explícito (não rolagem infinita): cada clique é um lote
  // limitado de consultas e o rodapé continua alcançável (NN/g, Baymard).
  if (model.hasMore && !model.loading) children.push(loadMoreButton(kind, actions));
  else if (!model.hasMore && !model.loading && shown) children.push(el('p', { className: 'tstb-feed-end' }, t('feed.end')));
  return el('div', { className: 'tstb-feed-footer' }, children);
}

function loadMoreButton(kind, actions) {
  const label = kind === 'short' ? t('feed.loadMoreShorts') : t('feed.loadOlder');
  return el('button', { type: 'button', className: 'tstb-button tstb-load-more', onClick: actions.loadMore }, label);
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
