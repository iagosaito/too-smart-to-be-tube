import { groupChannels, sortCategoriesByName } from '../core/categories.js';
import { sortByName } from '../core/channels.js';
import { normalizeText } from '../core/text.js';
import { localeTag, relativeTime, t } from '../i18n/i18n.js';

// Pure presentation rules (no DOM): kept separate so they can be tested without mounting the whole
// page.

export const FILTER_ALL = 'all';
export const FILTER_NONE = 'none';
export const SORT_NAME = 'name';
export const SORT_RECENT = 'recent';

// Re-exported so the UI keeps importing all presentation logic from here.
export { normalizeText };

export function visibleChannels(state, view) {
  const channels = channelsForFilter(state, view.filter);
  const query = normalizeText(view.query);
  const matching = query ? channels.filter((channel) => normalizeText(channel.name).includes(query)) : channels;
  return sortChannels(matching, view.sort, state.latestUploads ?? {});
}

export function sortChannels(channels, sort, latestUploads) {
  if (sort !== SORT_RECENT) return channels;
  // Channels already arrive in alphabetical order and the sort is stable: ties and channels with no
  // known date (which go to the end) stay in name order.
  const publishedAt = (channel) => latestUploads[channel.id] ?? -Infinity;
  return [...channels].sort((a, b) => publishedAt(b) - publishedAt(a));
}

function channelsForFilter(state, filter) {
  const locale = localeTag();
  const { groups, uncategorized } = groupChannels(state.categories, state.channels, locale);
  if (filter === FILTER_ALL) return sortByName(Object.values(state.channels), locale);
  if (filter === FILTER_NONE) return uncategorized;
  return groups.find((group) => group.category.id === filter)?.channels ?? [];
}

export function buildChips(state) {
  const locale = localeTag();
  const { groups, uncategorized } = groupChannels(sortCategoriesByName(state.categories, locale), state.channels, locale);
  // "No category" goes last because it is the work queue, not a destination.
  return [
    { id: FILTER_ALL, label: t('chips.all'), count: Object.keys(state.channels).length },
    ...groups.map(({ category, channels }) => ({ id: category.id, label: category.name, count: channels.length })),
    { id: FILTER_NONE, label: t('chips.none'), count: uncategorized.length },
  ];
}

export function resolveFilter(filter, categories) {
  // A deleted category would leave the screen "stuck" on a filter that doesn't exist.
  const isFixed = filter === FILTER_ALL || filter === FILTER_NONE;
  return isFixed || categories.some((category) => category.id === filter) ? filter : FILTER_ALL;
}

export function formatSyncInfo(lastSyncedAt, now) {
  if (lastSyncedAt == null) return t('sync.never');
  // Relative time is easier to judge than a date ("is this up to date?").
  if (now - lastSyncedAt < 60_000) return t('sync.justNow');
  return t('sync.ago', { time: relativeTime(now - lastSyncedAt) });
}

export function formatUploadAge(publishedAt, now) {
  if (publishedAt == null) return null;
  // The date comes from texts like "3 days ago", so that is the precision: we show the same
  // granularity as YouTube, without faking accuracy.
  if (now - publishedAt < 3_600_000) return t('upload.justNow');
  return t('upload.ago', { time: relativeTime(now - publishedAt) });
}

// Only what is on screen can be selected. Without this, a selected channel that left the grid
// (moved individually or hidden by the search) stayed selected, invisible, and was carried along by
// the bulk action.
export function pruneSelection(selected, visible) {
  const visibleIds = new Set(visible.map((channel) => channel.id));
  const kept = [...selected].filter((id) => visibleIds.has(id));
  // The same Set when nothing changes: avoids pointless work and re-renders.
  return kept.length === selected.size ? selected : new Set(kept);
}
