import { el, svgIcon } from '../ui/elements.js';
import { t } from '../i18n/i18n.js';
import { ICONS } from '../ui/icons.js';
import { SELECTORS } from './selectors.js';

export const ENTRY_ID = 'tstb-sidebar-entry';
export const MINI_ENTRY_ID = 'tstb-mini-entry';

// How many categories show before "Show more": the same limit YouTube uses for the Subscriptions
// list in the menu, so it feels native.
export const SIDEBAR_VISIBLE_CATEGORIES = 7;
const LIST_CLASS = 'tstb-sidebar-categories';

// State of the list in the menu, shared by every reinsertion: YouTube recreates the menu, and the
// list must come back the same (same categories, expanded or not).
const sidebarModel = { categories: [], onOpenCategory: null, expanded: false, activeId: null };

export function injectSidebarEntry(guide, onClick) {
  // SPA navigation triggers the injection several times; without this check the item would be
  // duplicated.
  const existing = guide.querySelector(`#${ENTRY_ID}`);
  if (existing) return existing;

  const firstSection = guide.querySelector(SELECTORS.guideSection);
  if (!firstSection) return null;

  // Inserted as a sibling of the section, not inside the item list, because YouTube's Polymer
  // re-renders those lists and would wipe our node.
  const entry = el('div', { id: ENTRY_ID, className: 'tstb-sidebar-entry' }, [buildSectionHeader(onClick), renderCategoryList()]);
  firstSection.after(entry);
  return entry;
}

// Updates the menu's category list (e.g. a category was created or renamed).
export function setSidebarCategories(categories, onOpenCategory) {
  Object.assign(sidebarModel, { categories, onOpenCategory });
  refreshCategoryList();
}

// Highlights the open category, the way YouTube highlights the current page.
export function markActiveSidebarCategory(categoryId) {
  if (sidebarModel.activeId === categoryId) return;
  sidebarModel.activeId = categoryId;
  // With a category open, the highlight goes to it, not to the "Categories" title.
  document.documentElement.classList.toggle('tstb-category-open', Boolean(categoryId));
  refreshCategoryList();
}

function refreshCategoryList() {
  document.querySelector(`#${ENTRY_ID} .${LIST_CLASS}`)?.replaceWith(renderCategoryList());
}

function renderCategoryList() {
  const { categories, expanded } = sidebarModel;
  const visible = expanded ? categories : categories.slice(0, SIDEBAR_VISIBLE_CATEGORIES);
  const items = visible.map(renderCategoryItem);
  if (categories.length > SIDEBAR_VISIBLE_CATEGORIES) items.push(renderToggle(expanded));
  return el('ul', { className: LIST_CLASS }, items);
}

function renderCategoryItem(category) {
  const active = category.id === sidebarModel.activeId;
  const onClick = () => sidebarModel.onOpenCategory?.(category.id);
  return el('li', {}, el('button', {
    type: 'button',
    className: active ? 'tstb-sidebar-category tstb-sidebar-category-active' : 'tstb-sidebar-category',
    'aria-current': active ? 'page' : null,
    title: category.name,
    onClick,
  }, [svgIcon(ICONS.folder), el('span', { className: 'tstb-sidebar-label' }, category.name)]));
}

function renderToggle(expanded) {
  const onClick = () => {
    sidebarModel.expanded = !expanded;
    refreshCategoryList();
  };
  return el('li', {}, el('button', { type: 'button', className: 'tstb-sidebar-category tstb-sidebar-toggle', 'aria-expanded': String(expanded), onClick }, [
    svgIcon(expanded ? ICONS.chevronUp : ICONS.chevronDown),
    el('span', { className: 'tstb-sidebar-label' }, expanded ? t('sidebar.showLess') : t('sidebar.showMore')),
  ]));
}

// The collapsed menu is a different YouTube component (icon on top, label below), so it gets its
// own item with the same behavior.
export function injectMiniGuideEntry(items, onClick) {
  const existing = items.querySelector(`#${MINI_ENTRY_ID}`);
  if (existing) return existing;

  // Here we go inside the native list: outside it the item sat in a container with different
  // spacing and came out misaligned. If Polymer re-renders the list, the next navigation reinserts
  // the item.
  const entry = el('div', { id: MINI_ENTRY_ID, className: 'tstb-mini-entry' }, buildButton('tstb-mini-button', onClick));
  const reference = findMiniGuideSlot(items);
  // Inserts into the reference's actual parent: if YouTube nests the items in an extra layer,
  // items.insertBefore would throw and the item wouldn't show up.
  (reference?.parentNode ?? items).insertBefore(entry, reference);
  return entry;
}

// YouTube redraws the menus (when expanding/collapsing, when refreshing subscriptions) and removes
// nodes that aren't its own. One observer per menu reinserts the item when it disappears; inserting
// fires the observer again, but by then the item exists and nothing happens. The WeakSet avoids
// stacking observers on the same menu on every navigation.
const keptMenus = new WeakSet();

function keepEntry(container, inject, options) {
  inject();
  if (keptMenus.has(container)) return null;
  keptMenus.add(container);
  const observer = new MutationObserver(inject);
  observer.observe(container, options);
  return observer;
}

export function keepMiniGuideEntry(items, onClick) {
  // Direct children only: the collapsed menu's list is flat.
  return keepEntry(items, () => injectMiniGuideEntry(items, onClick), { childList: true });
}

export function keepSidebarEntry(guide, onClick) {
  // Subtree because YouTube recreates the sections inside #sections, not the whole guide. The
  // callback only does an id lookup when nothing changed.
  return keepEntry(guide, () => injectSidebarEntry(guide, onClick), { childList: true, subtree: true });
}

function findMiniGuideSlot(items) {
  const entryOf = (selector) => items.querySelector(selector)?.closest(SELECTORS.miniGuideEntry) ?? null;
  const subscriptions = entryOf(SELECTORS.miniGuideSubscriptions);
  if (subscriptions) return subscriptions;
  // Without "Subscriptions" (e.g. logged out), it goes right after Shorts; without both, at the end
  // (null).
  return entryOf(SELECTORS.miniGuideShorts)?.nextElementSibling ?? null;
}

// In the expanded menu the item becomes a section title ("Categories ›"), in the same style as
// "Subscriptions ›" and "You ›": it makes clear that the categories below belong to it and that
// clicking the title opens the management page.
function buildSectionHeader(onClick) {
  return el('button', { type: 'button', className: 'tstb-sidebar-button tstb-sidebar-header', onClick }, [
    el('span', { className: 'tstb-sidebar-label' }, t('app.title')),
    svgIcon(ICONS.chevronRight),
  ]);
}

function buildButton(className, onClick) {
  // <button> instead of <a href="#">: it isn't navigation, and this way keyboard support and
  // accessibility come for free.
  return el('button', { type: 'button', className, onClick }, [
    svgIcon(ICONS.folder),
    el('span', { className: 'tstb-sidebar-label' }, t('app.title')),
  ]);
}
