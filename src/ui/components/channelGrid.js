import { sortCategoriesByName } from '../../core/categories.js';
import { el, svgIcon, syncChildren } from '../elements.js';
import { localeTag, t } from '../../i18n/i18n.js';
import { ICONS } from '../icons.js';
import { closeCategoryMenu, isCategoryMenuOpenFor, openCategoryMenu } from './categoryMenu.js';

// Every interaction re-renders the whole page (simple to maintain), but recreating hundreds of
// cards with images and selects on every click froze the UI. The cache returns the same DOM node
// when nothing about that card changed, so the browser neither recreates nor reloads the images.
export function createCardCache() {
  return { cards: new Map(), list: null };
}

// How the card offers "move to another category" depends on the view:
// - PILL: in "All", the pill shows each channel's category (useful information);
// - MOVE_ICON: inside a category, they would all be the same; the pill becomes a discreet icon on
//   hover, keeping the grid clean;
// - CHOOSE: in "No category", choosing is the main task; the pill invites action.
export const CATEGORY_CONTROL = { PILL: 'pill', MOVE_ICON: 'move-icon', CHOOSE: 'choose' };

// metaOf returns the card's supporting line (e.g. "Video 2 days ago") or null.
export function renderChannelGrid(channels, { categories, view, actions, cache = createCardCache(), metaOf = () => null, control = CATEGORY_CONTROL.PILL }) {
  // The select's options follow the same A–Z order as the chips.
  const sorted = sortCategoriesByName(categories, localeTag());
  const shared = { categories: sorted, actions, metaOf, control, categoryOf: mapCategoryByChannel(sorted), categoriesKey: keyOf(sorted) };
  const cards = channels.map((channel) => cachedCard(channel, view.selected.has(channel.id), shared, cache.cards));
  // The same <ul> is reused so that only the changed cards are swapped in the DOM.
  cache.list ??= el('ul');
  cache.list.className = view.selected.size ? 'tstb-grid tstb-selecting' : 'tstb-grid';
  syncChildren(cache.list, cards);
  return cache.list;
}

function cachedCard(channel, selected, shared, cache) {
  const categoryId = shared.categoryOf.get(channel.id) ?? '';
  const meta = shared.metaOf(channel);
  // Everything shown on the card goes into the key; if anything changes, it is recreated.
  const key = [channel.name, channel.avatar, categoryId, selected, meta, shared.control, shared.categoriesKey].join('\u0000');
  const cached = cache.get(channel.id);
  if (cached?.key === key) return cached.node;
  const node = renderCard(channel, { ...shared, categoryId, selected, meta });
  cache.set(channel.id, { key, node });
  return node;
}

function mapCategoryByChannel(categories) {
  // A Map avoids searching every category for the channel on each card.
  const map = new Map();
  categories.forEach((category) => category.channelIds.forEach((id) => map.set(id, category.id)));
  return map;
}

function keyOf(categories) {
  // The select's options depend on the category names; renaming must invalidate the cache.
  return categories.map((category) => `${category.id}=${category.name}`).join('|');
}

function renderCard(channel, options) {
  return el('li', { className: options.selected ? 'tstb-card tstb-card-selected' : 'tstb-card' }, [
    renderCheck(channel, options),
    renderCardLink(channel, options.actions, options.meta),
    renderCategoryControl(channel, options),
  ]);
}

function renderCategoryControl(channel, options) {
  if (options.control === CATEGORY_CONTROL.MOVE_ICON) return renderMoveIcon(channel, options);
  return renderCategoryPill(channel, options);
}

function renderMoveIcon(channel, options) {
  return renderMenuTrigger(channel, options, {
    className: 'tstb-move',
    label: t('card.moveLabel', { name: channel.name }),
    title: t('card.moveHint'),
    content: svgIcon(ICONS.moveToFolder),
    emptyLabel: t('chips.none'),
  });
}

function renderCheck(channel, { selected, actions }) {
  return el(
    'button',
    {
      type: 'button',
      className: 'tstb-check',
      role: 'checkbox',
      'aria-checked': String(selected),
      'aria-label': t('card.select', { name: channel.name }),
      'data-focus-key': `check:${channel.id}`,
      onClick: () => actions.toggleSelect(channel.id),
    },
    svgIcon(ICONS.check),
  );
}

function renderCardLink(channel, actions, meta) {
  // In selection mode a click on the card selects it (like in Google Photos), avoiding leaving the
  // page by accident in the middle of organizing. The mode is checked at click time so cached cards
  // don't keep an old mode.
  const onClick = (event) => {
    if (!actions.isSelecting()) return;
    event.preventDefault();
    actions.toggleSelect(channel.id);
  };
  return el('a', { className: 'tstb-card-link', href: channel.url, title: channel.name, onClick }, [
    renderAvatar(channel),
    el('span', { className: 'tstb-card-name' }, channel.name),
    meta ? el('span', { className: 'tstb-card-meta' }, meta) : null,
  ]);
}

function renderAvatar(channel) {
  if (channel.avatar) {
    // Async decoding moves image decoding off the main thread.
    return el('img', { className: 'tstb-avatar', src: channel.avatar, alt: '', loading: 'lazy', decoding: 'async' });
  }
  // Initial as a placeholder for channels read before their avatar loaded.
  return el('div', { className: 'tstb-avatar tstb-avatar-empty', 'aria-hidden': 'true' }, channel.name.charAt(0));
}

function renderCategoryPill(channel, options) {
  const choosing = options.control === CATEGORY_CONTROL.CHOOSE;
  // In the "No category" queue, repeating the obvious on every card doesn't help; the text invites
  // action.
  const emptyLabel = choosing ? t('card.choose') : t('chips.none');
  const current = options.categories.find((category) => category.id === options.categoryId);
  return renderMenuTrigger(channel, options, {
    // A different style for "No category" highlights what is still left to organize.
    className: current ? 'tstb-pill' : 'tstb-pill tstb-pill-empty',
    label: t('card.categoryLabel', { name: channel.name, category: current?.name ?? t('card.noCategory') }),
    content: [el('span', { className: 'tstb-pill-label' }, current?.name ?? emptyLabel), svgIcon(ICONS.chevronDown)],
    emptyLabel: t('chips.none'),
  });
}

// Button + custom menu instead of the native <select>: the menu only opens on click (not on mouse
// down) and only a clicked option changes the category.
function renderMenuTrigger(channel, { categories, categoryId, actions }, { className, label, title, content, emptyLabel }) {
  const items = () => [{ id: '', name: emptyLabel }, ...categories].map(({ id, name }) => ({ id, label: name, checked: id === categoryId }));
  const onClick = (event) => {
    const trigger = event.currentTarget;
    if (isCategoryMenuOpenFor(trigger)) return closeCategoryMenu();
    openCategoryMenu(trigger, {
      label,
      items: items(),
      // Choosing the current category doesn't need to save or redraw anything.
      onSelect: (id) => id !== categoryId && actions.assign(channel.id, id || null),
    });
  };
  return el(
    'button',
    {
      type: 'button',
      className,
      title: title ?? null,
      'aria-label': label,
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'data-focus-key': `pill:${channel.id}`,
      onClick,
    },
    content,
  );
}
