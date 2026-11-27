import { sortByName } from './channels.js';

const defaultMakeId = () => crypto.randomUUID();

// Limit enforced in the core (not just in the UI text field): names also arrive through CSV import
// and must respect the same length.
export const CATEGORY_NAME_MAX = 60;

export function cleanCategoryName(name) {
  return String(name ?? '').trim().slice(0, CATEGORY_NAME_MAX).trim();
}

// Every function returns a new array instead of mutating: state comes from storage and is
// re-rendered, so hidden mutations would cause subtle bugs.

export function createCategory(categories, name, makeId = defaultMakeId) {
  const cleanName = cleanCategoryName(name);
  if (!cleanName || hasCategoryNamed(categories, cleanName)) return categories;
  return [...categories, { id: makeId(), name: cleanName, channelIds: [] }];
}

export function renameCategory(categories, categoryId, name) {
  const cleanName = cleanCategoryName(name);
  if (!cleanName || hasCategoryNamed(categories, cleanName, categoryId)) return categories;
  return categories.map((category) =>
    category.id === categoryId ? { ...category, name: cleanName } : category,
  );
}

export function removeCategory(categories, categoryId) {
  // The removed category's channels naturally go back to "No category".
  return categories.filter((category) => category.id !== categoryId);
}

// A channel belongs to at most one category: keeps the UI simple (a single picker per channel) and
// avoids the channel showing up twice in the panel.
export function assignChannel(categories, channelId, categoryId) {
  return categories.map((category) => {
    const withoutChannel = category.channelIds.filter((id) => id !== channelId);
    const channelIds = category.id === categoryId ? [...withoutChannel, channelId] : withoutChannel;
    return { ...category, channelIds };
  });
}

// Reuses assignChannel so that bulk moves follow exactly the same "one category per channel" rule
// as single moves.
export function assignChannels(categories, channelIds, categoryId) {
  return channelIds.reduce((result, channelId) => assignChannel(result, channelId, categoryId), categories);
}

// Display order is always alphabetical, regardless of creation order: predictable positions let you
// find a category without reading the whole list, and they don't change when channels are moved (as
// they would when sorting by size).
export function sortCategoriesByName(categories, locale) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
}

export function findCategoryOf(categories, channelId) {
  return categories.find((category) => category.channelIds.includes(channelId)) ?? null;
}

export function groupChannels(categories, channelsById, locale) {
  const assigned = new Set();
  const groups = categories.map((category) => {
    // Ignores ids with no known channel (e.g. a cancelled subscription) instead of breaking.
    const channels = category.channelIds.map((id) => channelsById[id]).filter(Boolean);
    channels.forEach((channel) => assigned.add(channel.id));
    return { category, channels: sortByName(channels, locale) };
  });
  const uncategorized = Object.values(channelsById).filter((channel) => !assigned.has(channel.id));
  return { groups, uncategorized: sortByName(uncategorized, locale) };
}

function hasCategoryNamed(categories, name, ignoreId = null) {
  // Case-insensitive comparison: "Music" and "music" would confuse the user.
  const target = name.toLocaleLowerCase();
  return categories.some(
    (category) => category.id !== ignoreId && category.name.toLocaleLowerCase() === target,
  );
}
