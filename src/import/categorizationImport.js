import { cleanCategoryName, createCategory } from '../core/categories.js';
import { channelIdFromHref } from '../core/channels.js';
import { normalizeText } from '../core/text.js';

// The CSV format is always in English (Channel, Category, URL, Identifier), regardless of the UI
// language. The Portuguese names are still accepted because files exported by earlier versions used
// them.
const COLUMNS = {
  name: ['channel', 'name', 'canal', 'nome'],
  category: ['category', 'categoria'],
  url: ['url', 'link'],
  id: ['identifier', 'id', 'handle', 'identificador'],
};
// An empty cell already means "no category"; these texts are accepted for clarity and for the same
// compatibility with old files.
const NO_CATEGORY = new Set(['No category', 'Sem categoria'].map(normalizeText));
// Limits against malformed or malicious files. The size bounds everything that follows: 5 MB is ~60
// thousand channels and, since parsing and planning are linear, the worst case (minimal rows) takes
// ~1 s. Counting rows would be redundant.
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
// Cap on categories created at once: generous for any real organization, but it stops a file from
// filling the menu with junk.
export const MAX_NEW_CATEGORIES = 1_000;

export function readImport(rows) {
  const columns = mapColumns(rows[0] ?? []);
  // error is a translation key: the UI translates it in the active language.
  if (columns.category === undefined) return { entries: [], error: 'import.missingCategory' };
  if ([columns.id, columns.url, columns.name].every((index) => index === undefined)) {
    return { entries: [], error: 'import.missingIdentifier' };
  }
  const entries = rows.slice(1).map((row) => toEntry(row, columns));
  return entries.length ? { entries, error: null } : { entries, error: 'import.noRows' };
}

function mapColumns(header) {
  const normalized = header.map(normalizeText);
  const indexOf = (aliases) => {
    const index = normalized.findIndex((cell) => aliases.includes(cell));
    return index === -1 ? undefined : index;
  };
  return Object.fromEntries(Object.entries(COLUMNS).map(([key, aliases]) => [key, indexOf(aliases)]));
}

function toEntry(row, columns) {
  const cell = (key) => (columns[key] === undefined ? '' : unguard(row[columns[key]] ?? '').trim());
  const category = cell('category');
  // Empty or "No category" explicitly mean removing the channel from any category.
  return { id: cell('id'), url: cell('url'), name: cell('name'), category: NO_CATEGORY.has(normalizeText(category)) ? '' : category };
}

function unguard(value) {
  // Undoes the formula protection the export applies ("'=..." → "=...").
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

// The plan costs ~0.5 s with tens of thousands of rows and the review is redrawn on every
// interaction: reuse the last plan while the file and the state are the same. State is reloaded
// (new objects) on every write, so comparing by identity is enough to know whether it changed.
const planCache = new WeakMap();

export function cachedPlanImport(state, entries) {
  const cached = planCache.get(entries);
  if (cached?.channels === state.channels && cached.categories === state.categories) return cached.plan;
  const plan = planImport(state, entries);
  planCache.set(entries, { channels: state.channels, categories: state.categories, plan });
  return plan;
}

export function planImport(state, entries) {
  const { targets, unknown } = resolveTargets(state, entries);
  const created = newCategoryNames(state.categories, targets);
  const base = { matched: targets.size, created, unknown };
  // Nothing is applied when the file goes over the limit: better to reject it entirely than to
  // import half of it.
  if (created.length > MAX_NEW_CATEGORIES) {
    return { categories: state.categories, summary: { ...base, moved: 0, categoryCount: 0, error: 'import.tooManyCategories' } };
  }
  if (!targets.size) return { categories: state.categories, summary: { ...base, moved: 0, categoryCount: 0 } };
  const categories = created.reduce((list, name) => createCategory(list, name), state.categories);
  const targetIds = toCategoryIds(categories, targets);
  const summary = { ...base, moved: countMoved(state.categories, targetIds), categoryCount: new Set([...targetIds.values()].filter(Boolean)).size };
  return { categories: applyTargets(categories, targetIds), summary };
}

// One destination per channel, the last row wins: repeated rows for the same channel must not
// create one category per row.
function resolveTargets(state, entries) {
  const byName = new Map(Object.values(state.channels).map((channel) => [normalizeText(channel.name), channel.id]));
  const targets = new Map();
  const unknown = [];
  for (const entry of entries) {
    const channelId = resolveChannelId(entry, state.channels, byName);
    if (channelId) targets.set(channelId, cleanCategoryName(entry.category));
    else unknown.push(entry.name || entry.id || entry.url);
  }
  return { targets, unknown };
}

function newCategoryNames(categories, targets) {
  // Reuses an existing category with the same name (ignoring accents/case).
  const known = new Set(categories.map((category) => normalizeText(category.name)));
  const created = [];
  for (const name of targets.values()) {
    const key = normalizeText(name);
    if (!name || known.has(key)) continue;
    known.add(key);
    created.push(name);
  }
  return created;
}

function toCategoryIds(categories, targets) {
  // Index by normalized name: searching with find on every row made the plan quadratic.
  const idByName = new Map(categories.map((category) => [normalizeText(category.name), category.id]));
  return new Map([...targets].map(([channelId, name]) => [channelId, name ? idByName.get(normalizeText(name)) : null]));
}

function countMoved(originalCategories, targetIds) {
  // "Changes category" is relative to what the user has today.
  const original = new Map(originalCategories.flatMap((category) => category.channelIds.map((id) => [id, category.id])));
  return [...targetIds].filter(([channelId, categoryId]) => (original.get(channelId) ?? null) !== categoryId).length;
}

function applyTargets(categories, targetIds) {
  // A single pass: takes the imported channels out of where they were and puts them in the
  // destination.
  const additions = new Map();
  for (const [channelId, categoryId] of targetIds) {
    if (!categoryId) continue;
    if (!additions.has(categoryId)) additions.set(categoryId, []);
    additions.get(categoryId).push(channelId);
  }
  return categories.map((category) => ({
    ...category,
    channelIds: [...category.channelIds.filter((id) => !targetIds.has(id)), ...(additions.get(category.id) ?? [])],
  }));
}

function resolveChannelId(entry, channels, byName) {
  // Ordered from most to least reliable: a channel name can change or repeat.
  const candidates = [channelIdFromHref(entry.id), channelIdFromHref(entry.url), byName.get(normalizeText(entry.name))];
  return candidates.find((id) => id && channels[id]) ?? null;
}
