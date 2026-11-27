import { t } from '../i18n/i18n.js';
import { CATEGORY_CONTROL, renderChannelGrid } from './components/channelGrid.js';
import { renderChips } from './components/chips.js';
import { renderFeed } from './components/feedView.js';
import { renderBulkBar, renderEmptyState } from './components/feedback.js';
import { renderHeader } from './components/header.js';
import { renderImportReview } from './components/importReview.js';
import { cachedPlanImport } from '../import/categorizationImport.js';
import { renderViewHeading } from './components/viewHeading.js';
import { buildChips, FILTER_ALL, FILTER_NONE, formatUploadAge, SORT_RECENT, visibleChannels } from './view.js';

// Fixed regions of the page. Each render fills each region separately, so the grid (the expensive
// part) isn't touched when only the header changes.
export const SLOTS = ['header', 'review', 'chips', 'heading', 'results', 'bulkBar'];

// env groups what is neither state nor action: the clock (injectable in tests) and the card cache.
export function renderPage(state, view, actions, { now, cardCache, feed }) {
  const channels = visibleChannels(state, view);
  const common = commonParts(state, view, actions, now, channels);
  // Inside a category, on the Videos and Shorts tabs, the results are the feed: the channel grid
  // isn't even built (with hundreds of channels it cost thousands of elements per render, only to
  // be thrown away).
  if (feed) return { ...common, results: renderFeed(feed, actions), bulkBar: null };
  return { ...common, ...managementParts(state, view, actions, now, channels, cardCache) };
}

function commonParts(state, view, actions, now, channels) {
  return {
    header: renderHeader({ state, view, actions, now }),
    review: view.pendingImport ? renderPendingImport(state, view.pendingImport, actions) : null,
    chips: renderChips(buildChips(state), view.filter, actions),
    heading: renderViewHeading(state, view, actions, channels.length),
  };
}

function managementParts(state, view, actions, now, channels, cardCache) {
  return {
    results: channels.length
      ? renderChannelGrid(channels, {
        categories: state.categories,
        view,
        actions,
        cache: cardCache,
        metaOf: metaFor(state, view, now),
        control: categoryControlFor(view.filter),
      })
      : renderEmptyState(emptyStateFor(state, view, actions)),
    bulkBar: view.selected.size ? renderBulkBar(state.categories, view.selected.size, actions) : null,
  };
}

function categoryControlFor(filter) {
  if (filter === FILTER_ALL) return CATEGORY_CONTROL.PILL;
  if (filter === FILTER_NONE) return CATEGORY_CONTROL.CHOOSE;
  return CATEGORY_CONTROL.MOVE_ICON;
}

function metaFor(state, view, now) {
  // When sorted by recency, saying "no recent videos" explains why the channel is at the end; in
  // A–Z it would just be noise, so the line goes away.
  const fallback = view.sort === SORT_RECENT ? t('upload.none') : null;
  return (channel) => formatUploadAge(state.latestUploads?.[channel.id], now) ?? fallback;
}

function renderPendingImport(state, pending, actions) {
  // The summary follows the current state (if the user changes something while reviewing, the
  // numbers match what will be applied), but it is only recomputed when the state actually changes.
  const summary = pending.entries ? cachedPlanImport(state, pending.entries).summary : null;
  return renderImportReview(pending, summary, actions);
}

function emptyStateFor(state, view, actions) {
  if (!Object.keys(state.channels).length) {
    const action = actions.canSync ? { label: t('empty.noSubscriptions.action'), onClick: actions.sync } : null;
    return { title: t('empty.noSubscriptions.title'), text: t('empty.noSubscriptions.text'), action };
  }
  if (view.query) {
    const action = { label: t('empty.noResults.action'), onClick: () => actions.search('') };
    return { title: t('empty.noResults.title'), text: t('empty.noResults.text', { query: view.query }), action };
  }
  if (view.filter === FILTER_NONE) {
    return { title: t('empty.allSorted.title'), text: t('empty.allSorted.text') };
  }
  return {
    title: t('empty.category.title'),
    text: t('empty.category.text'),
    action: { label: t('empty.category.action'), onClick: () => actions.setFilter(FILTER_NONE) },
  };
}
