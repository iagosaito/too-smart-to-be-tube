import { assignChannel, assignChannels, createCategory, removeCategory, renameCategory } from '../core/categories.js';
import { SELECTORS } from '../dom/selectors.js';
import { closeCategoryMenu, closeCategoryMenuIfDetached } from './components/categoryMenu.js';
import { createCardCache } from './components/channelGrid.js';
import { createFeedCardCache } from './components/feedView.js';
import { FEED_TAB } from '../feed/categoryFeed.js';
import { createFeedController, modelOf } from '../feed/feedController.js';
import { markActiveSidebarCategory } from '../dom/sidebar.js';
import { csvFileName, subscriptionsCsv } from '../export/subscriptionsCsv.js';
import { parseCsv } from '../import/csvParse.js';
import { cachedPlanImport, MAX_IMPORT_BYTES, readImport } from '../import/categorizationImport.js';
import { showToast } from './components/feedback.js';
import { downloadTextFile } from './download.js';
import { pickFile } from './filePicker.js';
import { el, syncChildren } from './elements.js';
import { preserveFocus } from './focus.js';
import { renderPage, SLOTS } from './render.js';
import { describeError } from '../i18n/errors.js';
import { plural, t } from '../i18n/i18n.js';
import { FILTER_ALL, pruneSelection, resolveFilter, SORT_NAME, visibleChannels } from './view.js';

export const PAGE_ID = 'tstb-page';
export const OPEN_CLASS = 'tstb-page-open';
// Waits for a pause in typing before redrawing: filtering on every keystroke made typing lag with
// many subscriptions.
const SEARCH_DELAY_MS = 150;
// Longer than the default to give time to click "Undo".
const UNDO_TOAST_MS = 10_000;
// Syncing on every open would make dozens of pointless requests; once an hour is enough.
const AUTO_SYNC_AFTER_MS = 60 * 60 * 1000;

export async function openCategoriesPage(options) {
  const context = createContext(options);
  const page = mountPage();
  if (options.feedSource) {
    context.feed = createFeedController({ source: options.feedSource, onChange: () => scheduleRender(page, context) });
  }
  // The previous page is only hidden (not destroyed), so a video would keep playing.
  document.querySelector('video')?.pause();
  await reload(page, context);
  // Also follows a sync already in progress (started by another instance of the page), to show
  // "Syncing…" instead of offering another one.
  if (context.sync && (context.sync.isRunning() || needsSync(context.state, context.now()))) runSync(page, context);
  return page;
}

export function closeCategoriesPage() {
  closeCategoryMenu();
  markActiveSidebarCategory(null);
  document.getElementById(PAGE_ID)?.remove();
  document.documentElement.classList.remove(OPEN_CLASS);
}

function needsSync(state, now) {
  // Null fields: someone who already used the extension doesn't have the dates or the feed yet (nor
  // the channels' ucid), so it syncs right away instead of waiting for the next full hour. If the
  // feed was already attempted and failed, it waits for the next regular sync: retrying on every
  // open would repeat ~100 requests.
  const feedMissing = state.uploadsSyncedAt == null || state.feedSyncedAt == null;
  return isStale(state.lastSyncedAt, now) || (feedMissing && state.feedAttemptedAt == null);
}

function syncCooldownLeft(context) {
  return context.sync ? Math.max(0, context.sync.availableAt() - context.now()) : 0;
}

export function isStale(lastSyncedAt, now) {
  return lastSyncedAt == null || now - lastSyncedAt > AUTO_SYNC_AFTER_MS;
}

function createContext(options) {
  return {
    confirm: (message) => window.confirm(message),
    download: downloadTextFile,
    pickFile,
    now: Date.now,
    searchDelay: SEARCH_DELAY_MS,
    ...options,
    state: null,
    cardCache: createCardCache(),
    feedCardCache: createFeedCardCache(),
    feed: null,
    feedSession: null,
    renderQueued: false,
    searchTimer: null,
    cooldownTimer: null,
    // Screen-only state (filter, search, selection): not saved, like YouTube's own search.
    view: {
      filter: options.initialFilter ?? FILTER_ALL,
      // Watching comes before organizing: categories open on the videos.
      tab: options.initialTab ?? FEED_TAB.VIDEOS,
      query: '',
      sort: null,
      selected: new Set(),
      syncing: false,
      syncError: '',
      pendingImport: null,
    },
  };
}

function mountPage() {
  closeCategoriesPage();
  const slots = SLOTS.map((name) => el('div', { className: 'tstb-slot', 'data-slot': name }));
  const page = el('div', { id: PAGE_ID, className: 'tstb-page', role: 'main' }, slots);
  // Inside ytd-page-manager we inherit the header's and sidebar's margins, so the page fits
  // YouTube's layout without fragile CSS.
  (document.querySelector(SELECTORS.pageManager) ?? document.body).append(page);
  document.documentElement.classList.add(OPEN_CLASS);
  window.scrollTo?.(0, 0);
  return page;
}

async function reload(page, context) {
  // Storage is the source of truth; reloading after every write avoids diverging state.
  context.state = await context.store.load();
  // The chosen sort order is remembered across visits; it is only read from storage on the first
  // load.
  context.view.sort ??= context.state.preferences.sortBy ?? SORT_NAME;
  render(page, context);
}

function render(page, context) {
  if (!page.isConnected) return;
  context.view.filter = resolveFilter(context.view.filter, context.state.categories);
  context.view.selected = pruneSelection(context.view.selected, visibleChannels(context.state, context.view));
  context.view.syncCoolingDown = syncCooldownLeft(context) > 0;
  scheduleCooldownEnd(page, context);
  const now = context.now();
  const env = { now, cardCache: context.cardCache, feed: feedEnvFor(context, now) };
  const parts = renderPage(context.state, context.view, createActions(page, context), env);
  markActiveSidebarCategory(context.state.categories.some((category) => category.id === context.view.filter) ? context.view.filter : null);
  preserveFocus(page, () => fillSlots(page, parts));
  closeCategoryMenuIfDetached();
}

function fillSlots(page, parts) {
  for (const slot of page.children) syncChildren(slot, parts[slot.dataset.slot] ? [parts[slot.dataset.slot]] : []);
}

function feedEnvFor(context, now) {
  const { state, view } = context;
  const category = state.categories.find((item) => item.id === view.filter);
  if (!context.feed || !category || view.tab === FEED_TAB.CHANNELS) {
    context.feedSession = null;
    return null;
  }
  const channels = category.channelIds.map((id) => state.channels[id]).filter(Boolean);
  context.feedSession = context.feed.sessionFor(category, view.tab, channels, state.latestUploads);
  return { tab: view.tab, model: modelOf(context.feedSession, state.feedItems), channelsById: state.channels, now, cache: context.feedCardCache, query: view.query };
}

function scheduleRender(page, context) {
  // Several channels in a batch finish almost together: a single redraw for all of them.
  if (context.renderQueued) return;
  context.renderQueued = true;
  queueMicrotask(() => {
    context.renderQueued = false;
    render(page, context);
  });
}

function scheduleCooldownEnd(page, context) {
  // Redraws when the interval ends, so the button re-enables on its own.
  clearTimeout(context.cooldownTimer);
  const left = syncCooldownLeft(context);
  if (left > 0) context.cooldownTimer = setTimeout(() => render(page, context), left);
}

async function runSync(page, context) {
  Object.assign(context.view, { syncing: true, syncError: '' });
  render(page, context);
  try {
    await context.sync.sync();
  } catch (error) {
    context.view.syncError = describeError(error);
  }
  context.view.syncing = false;
  await reload(page, context);
}

function createActions(page, context) {
  return {
    ...viewActions(page, context),
    ...dataActions(page, context),
    sync: () => runSync(page, context),
    hasFeed: Boolean(context.feed),
    loadMore: () => context.feedSession && context.feed.loadMore(context.feedSession, context.state.feedItems),
    canSync: Boolean(context.sync),
    exportCsv: () => exportSubscriptions(context),
    importCsv: () => startImport(page, context),
    applyImport: () => applyImport(page, context),
  };
}

function viewActions(page, context) {
  const update = (changes) => {
    Object.assign(context.view, changes);
    render(page, context);
  };
  return {
    // Switching categories clears the selection so we don't move channels the user no longer sees.
    setFilter: (filter) => update({ filter, selected: new Set() }),
    search: (query) => update({ query }),
    searchAsYouType: (query) => scheduleSearch(page, context, query),
    isSelecting: () => context.view.selected.size > 0,
    setSort: (sort) => {
      update({ sort });
      // Saving the preference doesn't need to block the screen; a failure only means the order
      // isn't remembered.
      context.store.savePreferences({ sortBy: sort }).catch(() => {});
    },
    toggleSelect: (channelId) => update({ selected: toggled(context.view.selected, channelId) }),
    clearSelection: () => update({ selected: new Set() }),
    rerender: () => update({}),
    cancelImport: () => update({ pendingImport: null }),
    // Switching tabs clears the selection: it only exists in the channel list.
    setTab: (tab) => update({ tab, selected: new Set() }),
  };
}

function scheduleSearch(page, context, query) {
  // The query is saved right away, and only the redraw waits: that way a re-render coming from
  // another action (e.g. a sync finishing) doesn't wipe what was typed.
  context.view.query = query;
  clearTimeout(context.searchTimer);
  context.searchTimer = setTimeout(() => render(page, context), context.searchDelay);
}

async function saveCategories(page, context, next, viewChanges = {}) {
  await context.store.saveCategories(next);
  Object.assign(context.view, viewChanges);
  await reload(page, context);
}

function dataActions(page, context) {
  const categories = () => context.state.categories;
  const save = (next, viewChanges) => saveCategories(page, context, next, viewChanges);
  return {
    create: (name) => createAndOpen(categories(), name, save),
    rename: (categoryId, name) => save(renameCategory(categories(), categoryId, name)),
    remove: (category) => removeWithConfirmation(context, category, save),
    assign: (channelId, categoryId) => save(assignChannel(categories(), channelId, categoryId)),
    moveSelected: (categoryId) => moveSelection(context, categoryId, save),
  };
}

async function createAndOpen(categories, name, save) {
  const next = createCategory(categories, name);
  // Opening the newly created category takes the user straight to the next step: filling it.
  const created = next.length > categories.length ? next.at(-1) : null;
  await save(next, created ? { filter: created.id, selected: new Set() } : {});
}

async function removeWithConfirmation(context, category, save) {
  const count = category.channelIds.length;
  const detail = count ? ` ${plural('confirm.deleteDetail', count, { none: t('chips.none') })}` : '';
  // Confirmation because deleting has no "undo" and throws away manual organizing work.
  if (!context.confirm(`${t('confirm.delete', { name: category.name })}${detail}`)) return;
  await save(removeCategory(context.state.categories, category.id), { filter: FILTER_ALL });
  showToast(t('toast.categoryDeleted', { name: category.name }));
}

async function moveSelection(context, categoryId, save) {
  const ids = [...context.view.selected];
  const target = context.state.categories.find((category) => category.id === categoryId)?.name ?? t('chips.none');
  await save(assignChannels(context.state.categories, ids, categoryId), { selected: new Set() });
  showToast(plural('toast.moved', ids.length, { target }));
}

function exportSubscriptions(context) {
  // Exports from the saved state (not from the screen), so filter and search don't affect the file.
  const { state } = context;
  context.download(csvFileName(context.now()), subscriptionsCsv(state));
  const count = Object.keys(state.channels).length;
  showToast(plural('toast.exported', count));
}

async function startImport(page, context) {
  const file = await context.pickFile();
  if (!file) return;
  context.view.pendingImport = await readImportFile(file);
  render(page, context);
  // Takes focus and screen readers straight to the result of the action the user just took.
  page.querySelector('.tstb-review h3')?.focus();
}

async function readImportFile(file) {
  // error is a translation key, like readImport's errors.
  if (file.size > MAX_IMPORT_BYTES) return { fileName: file.name, error: 'import.tooLarge' };
  const { entries, error } = readImport(parseCsv(await file.text()));
  return { fileName: file.name, entries: error ? null : entries, error };
}

async function applyImport(page, context) {
  const previous = context.state.categories;
  // The same plan (from the cache) the review shows now, computed with the current state.
  const { categories, summary } = cachedPlanImport(context.state, context.view.pendingImport.entries);
  // The review already hides the button in these cases; this check guarantees nothing over the
  // limit is saved even if the action is called some other way.
  if (summary.error || !summary.matched) return;
  await saveCategories(page, context, categories, { pendingImport: null, filter: FILTER_ALL, selected: new Set() });
  const undo = () => saveCategories(page, context, previous);
  const message = t('import.summary', { channels: plural('import.organized', summary.matched), categories: plural('import.categories', summary.categoryCount) });
  showToast(message, { duration: UNDO_TOAST_MS, action: { label: t('common.undo'), onClick: undo } });
}

function toggled(set, value) {
  // A new Set instead of mutating: screen state is treated as immutable, like everything else.
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
