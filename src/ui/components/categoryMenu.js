import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';

// Custom menu for choosing a channel's category. It replaces the native <select> in the cards: in
// Chrome, after YouTube's sidebar was toggled, the native list opened under the cursor and
// releasing the mouse button already picked an option. Here only an explicit click on an option
// picks something.

export const MENU_ID = 'tstb-category-menu';
const GAP = 4;
const VIEWPORT_MARGIN = 8;

let openMenu = null;

// items: [{ id, label, checked }]. onSelect receives the chosen id.
export function openCategoryMenu(anchor, { label, items, onSelect }) {
  closeCategoryMenu();
  const menu = el('div', { id: MENU_ID, className: 'tstb-menu', role: 'menu', 'aria-label': label });
  const close = (restoreFocus) => closeCategoryMenu({ restoreFocus });
  menu.append(...items.map((item) => renderItem(item, () => {
    close(true);
    onSelect(item.id);
  })));
  menu.addEventListener('keydown', (event) => handleKeydown(event, menu, close));
  // Lives in <body>, outside the page: it isn't wiped by re-renders or clipped by the grid.
  document.body.append(menu);
  anchor.setAttribute('aria-expanded', 'true');
  openMenu = { menu, anchor, cleanup: listenForDismiss(menu, anchor, close) };
  positionMenu(menu, anchor);
  (menu.querySelector('[aria-checked="true"]') ?? menu.firstElementChild)?.focus();
  return menu;
}

export function isCategoryMenuOpenFor(anchor) {
  return openMenu?.anchor === anchor;
}

export function closeCategoryMenu({ restoreFocus = false } = {}) {
  if (!openMenu) return;
  const { menu, anchor, cleanup } = openMenu;
  openMenu = null;
  cleanup();
  menu.remove();
  anchor.setAttribute('aria-expanded', 'false');
  if (restoreFocus && anchor.isConnected) anchor.focus();
}

// The card that opened the menu may disappear in a re-render (e.g. when a sync finishes); a menu
// without an anchor would float in the wrong place.
export function closeCategoryMenuIfDetached() {
  if (openMenu && !openMenu.anchor.isConnected) closeCategoryMenu();
}

function renderItem({ label, checked }, choose) {
  return el(
    'button',
    { type: 'button', className: 'tstb-menu-item', role: 'menuitemradio', 'aria-checked': String(checked), tabindex: '-1', onClick: choose },
    [el('span', { className: 'tstb-menu-check' }, checked ? svgIcon(ICONS.check) : null), el('span', {}, label)],
  );
}

function listenForDismiss(menu, anchor, close) {
  // Clicking outside closes without choosing anything. A click on the trigger itself is ignored
  // here: the trigger already toggles the menu on its own click.
  const onPointerDown = (event) => {
    if (!menu.contains(event.target) && !anchor.contains(event.target)) close(false);
  };
  // Scrolling or resizing would move the menu away from its anchor; closing is more predictable
  // than trying to follow.
  const onViewportChange = (event) => {
    // Scrolling the menu's own list doesn't count. The target may be window or document (not
    // elements), so we only use contains with an Element.
    const insideMenu = event.target instanceof Element && menu.contains(event.target);
    if (!insideMenu) close(false);
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
  };
}

function handleKeydown(event, menu, close) {
  const items = [...menu.querySelectorAll('.tstb-menu-item')];
  const index = items.indexOf(document.activeElement);
  const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
  if (event.key in moves) {
    event.preventDefault();
    items[(moves[event.key] + items.length) % items.length].focus();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    close(true);
  } else if (event.key === 'Tab') {
    close(false);
  }
}

export function positionMenu(menu, anchor) {
  // Position computed on the spot from where the trigger is now.
  const rect = anchor.getBoundingClientRect();
  const height = menu.offsetHeight;
  const width = menu.offsetWidth;
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  // Opens downward; only flips upward if it doesn't fit and there is more room above.
  const openUp = height > spaceBelow && rect.top > spaceBelow;
  const top = openUp ? rect.top - height - GAP : rect.bottom + GAP;
  const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - width - VIEWPORT_MARGIN);
  menu.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
  menu.style.left = `${Math.max(VIEWPORT_MARGIN, left)}px`;
}
