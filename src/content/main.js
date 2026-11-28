import { scrapeChannels } from '../dom/scraper.js';
import { SELECTORS } from '../dom/selectors.js';
import { keepMiniGuideEntry, keepSidebarEntry, setSidebarCategories } from '../dom/sidebar.js';
import { sortCategoriesByName } from '../core/categories.js';
import { createChannelTabCache } from '../feed/channelTabCache.js';
import { createFeedSource } from '../feed/feedSource.js';
import { localeTag } from '../i18n/i18n.js';
import { createRequestQueue } from '../sync/requestQueue.js';
import { clientVersionFromDocument } from '../youtube/pageData.js';
import { waitFor } from '../dom/waitFor.js';
import { createStore } from '../storage/store.js';
import { showToast } from '../ui/components/feedback.js';
import { routeFromUrl } from '../ui/categoryRoute.js';
import { closeCategoriesPage, isCategoriesPageOpen, openCategoriesPage } from '../ui/page.js';
import { t } from '../i18n/i18n.js';
import { createSyncCoordinator } from '../sync/syncCoordinator.js';
import { runIfAlive } from './extensionContext.js';
import { fetchSubscriptionFeed, latestByChannel } from '../youtube/recentUploads.js';
import { fetchAllSubscriptions } from '../youtube/subscriptions.js';

const store = createStore(chrome.storage.local);

async function syncFromDom() {
  const channels = scrapeChannels(document);
  // Saves nothing when the read comes back empty (DOM still loading).
  if (channels.length) await store.mergeChannels(channels);
}

async function syncAllSubscriptions() {
  const channels = await fetchAllSubscriptions();
  await store.replaceChannels(channels);
  await syncLatestUploads();
  return channels.length;
}

// One coordinator per tab, shared by every Categories page opened in it: repeated clicks don't
// start syncs in parallel.
const syncCoordinator = createSyncCoordinator(syncAllSubscriptions);

async function syncLatestUploads() {
  // The subscriptions feed is an extra: if it fails, the subscriptions list (already saved) still
  // stands and the error must not bring the sync down.
  try {
    const videos = await fetchSubscriptionFeed();
    // The same videos feed each channel's latest upload date and the per-category feed (Videos
    // tab), with no extra requests.
    await store.saveUploads(latestByChannel(videos));
    await store.saveFeed(videos);
  } catch (error) {
    console.warn('[Too Smart To Be Tube] Could not read the subscriptions feed:', error);
  }
}

// Per-category feed source, one per tab: a persisted cache and a queue that paces the public
// channel requests. The queue's pause and cap live in storage, so they apply to every open YouTube
// tab.
const feedSource = createFeedSource({
  cache: createChannelTabCache({ storage: store.channelTabStorage }),
  queue: createRequestQueue({ shared: { load: store.loadRequestBudget, save: store.saveRequestBudget } }),
  clientVersion: () => clientVersionFromDocument(document),
});

// Bumped on every navigation (YouTube's or Back/Forward). Opening waits on storage first, and a
// navigation in that gap means the user has moved on: mounting then would cover the new page and
// write a Categories entry over the history they just walked.
let navigation = 0;
const navigated = () => {
  navigation += 1;
};

async function openCategories(options = {}) {
  const started = navigation;
  // Reading the DOM is instant and shows something right away while the full sync (several
  // requests) runs in the background.
  await runIfAlive(async () => {
    await syncFromDom();
    if (navigation === started) await openCategoriesPage({ store, sync: syncCoordinator, feedSource, ...options });
  }, warnOrphaned);
}

// Clicking a category in the sidebar opens its feed directly.
const openCategoryFeed = (categoryId) => openCategories({ initialFilter: categoryId });

async function refreshSidebarCategories(categories) {
  const list = categories ?? (await store.load()).categories;
  setSidebarCategories(sortCategoriesByName(list, localeTag()), openCategoryFeed);
}

function warnOrphaned() {
  // Only opening the page warns (a click or a Categories URL): in background tasks it would be an
  // alert with no context on every navigation.
  closeCategoriesPage();
  showToast(t('toast.extensionUpdated'), {
    duration: 15_000,
    action: { label: t('common.reload'), onClick: () => window.location.reload() },
  });
}

function stopBackgroundWork() {
  // Orphaned script: stop reacting to navigations. The next page load injects the extension's new
  // script.
  document.removeEventListener('yt-navigate-finish', setup);
  window.removeEventListener('popstate', followHistory);
}

// The menus may only be mounted long after the page loads (e.g. in a narrow window the expanded
// menu only exists once the user opens ☰). Each wait starts once; after that the menu's observer
// keeps the item in place.
const waiting = new Set();
// Without the menu's container, the wait watches the whole document: with a deadline, so it doesn't
// run on every page mutation (including during a video). The next navigation tries again.
const DOCUMENT_WAIT_MS = 10_000;

async function whenPresent(selector, keep, scopeSelector) {
  const current = document.querySelector(selector);
  // If YouTube recreated the whole menu, this is a new element: start observing it.
  if (current) return keep(current);
  if (waiting.has(selector)) return;
  waiting.add(selector);
  try {
    keep(await waitFor(selector, waitScope(scopeSelector)));
  } catch {
    // Deadline passed without the menu: nothing to do until the next navigation.
  } finally {
    waiting.delete(selector);
  }
}

function waitScope(scopeSelector) {
  // Inside the menu's container mutations are rare, so we can wait with no deadline for the moment
  // the user opens the menu.
  const scope = document.querySelector(scopeSelector);
  return scope ? { root: scope, timeout: null } : { timeout: DOCUMENT_WAIT_MS };
}

function setupMenus() {
  whenPresent(SELECTORS.miniGuideItems, (items) => keepMiniGuideEntry(items, openCategories), SELECTORS.miniGuide);
  // Waits for a section, not just ytd-guide-renderer, because it exists empty before YouTube fills
  // in the menu.
  whenPresent(SELECTORS.guideSection, (section) => keepSidebarEntry(section.closest(SELECTORS.guide) ?? section.parentElement, openCategories), SELECTORS.guideDrawer);
}

// A Categories URL (refresh, Back/Forward, a bookmark) reopens the view it names. Both a YouTube
// navigation and popstate may ask for the same opening; the one in flight serves both.
let openingFromUrl = null;

function openFromUrl() {
  if (!routeFromUrl(window.location.href) || isCategoriesPageOpen() || openingFromUrl) return openingFromUrl;
  const started = navigation;
  openingFromUrl = openRoute()
    .catch((error) => console.warn('[Too Smart To Be Tube] Could not open the Categories URL:', error))
    .finally(() => {
      openingFromUrl = null;
    })
    // A navigation during the opening may have closed the page (or skipped it) while its own
    // request to open was turned away by the one in flight: it gets its turn now.
    .then(() => (navigation !== started ? openFromUrl() : null));
  return openingFromUrl;
}

async function openRoute() {
  // On a fresh load the content script may run before YouTube mounts the page manager.
  await waitFor(SELECTORS.pageManager, { timeout: DOCUMENT_WAIT_MS }).catch(() => null);
  // Read again after waiting: the user may have left in the meantime.
  const route = routeFromUrl(window.location.href);
  if (route && !isCategoriesPageOpen()) await openCategories({ initialFilter: route.filter, initialTab: route.tab });
}

// Back/Forward between a Categories URL and the YouTube page underneath may not trigger a YouTube
// navigation (the page underneath never changed), so history is followed here too.
function followHistory() {
  navigated();
  if (routeFromUrl(window.location.href)) openFromUrl();
  else closeCategoriesPage();
}

async function setup() {
  setupMenus();
  openFromUrl();
  runIfAlive(refreshSidebarCategories, stopBackgroundWork);
  await runIfAlive(syncFromDom, stopBackgroundWork);
}

function leavePage() {
  navigated();
  closeCategoriesPage();
}

// YouTube is an SPA: the content script runs once, but the page changes without reloading. These
// are the events the site itself fires on every change; closing at the start of a navigation makes
// the Categories page behave like any other YouTube page.
document.addEventListener('yt-navigate-start', leavePage);
document.addEventListener('yt-navigate-finish', setup);
window.addEventListener('popstate', followHistory);
setup();

// Keeps the sidebar list up to date when categories change (including from another YouTube tab open
// at the same time).
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area === 'local' && changes.categories) refreshSidebarCategories(changes.categories.newValue ?? []);
});
