import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { CATEGORY_NAME_MAX } from '../../core/categories.js';
import { plural, t } from '../../i18n/i18n.js';
import { FILTER_NONE, SORT_NAME, SORT_RECENT } from '../view.js';
import { FEED_TAB } from '../../feed/categoryFeed.js';
import { renderCategoryTabs } from './categoryTabs.js';

// Two zones split by the object they act on: on the left, the category (editable name and delete);
// on the right, the list (sort). Delete next to Sort mixed a rare, destructive action with a
// frequently used control.
export function renderViewHeading(state, view, actions, count) {
  const category = state.categories.find((item) => item.id === view.filter);
  // Tabs only inside a category: "All" and "No category" are organizing screens.
  const tabs = category && actions.hasFeed;
  const heading = el('div', { className: 'tstb-view-heading' }, [
    el('div', { className: 'tstb-title-group' }, [
      renderTitle(category, view, count, actions),
      category ? renderDeleteButton(category, actions) : null,
    ]),
    tabs ? null : el('div', { className: 'tstb-heading-actions' }, [renderSortSelect(view.sort, actions), category ? null : renderSelectionHint()]),
  ]);
  // The tabs stay outside .tstb-view-heading: renaming replaces only the title.
  return tabs ? el('div', { className: 'tstb-view-header' }, [heading, renderTabBar(view, actions)]) : heading;
}

// Sort sits on the tab bar, where it lines up with the list it orders, instead of beside the
// category's name, where it read as acting on the category. It only orders channels, so the feed
// tabs don't show it.
function renderTabBar(view, actions) {
  const sort = view.tab === FEED_TAB.CHANNELS ? renderSortSelect(view.sort, actions) : null;
  return el('div', { className: 'tstb-tabbar' }, [renderCategoryTabs(view.tab, actions), sort]);
}

function renderTitle(category, view, count, actions) {
  const countLabel = el('span', { className: 'tstb-count' }, ` · ${plural('heading.channels', count)}`);
  if (!category) {
    const title = view.filter === FILTER_NONE ? t('chips.none') : t('heading.all');
    return el('h2', { className: 'tstb-view-title' }, [title, countLabel]);
  }
  return el('h2', { className: 'tstb-view-title' }, [renderEditableName(category, actions), countLabel]);
}

function renderEditableName(category, actions) {
  // Renaming by clicking the name itself (like a document title in Notion/Docs) avoids a button for
  // a rare action. Only the background and the text cursor on hover show that it's editable: a
  // hidden pencil reserved space and left a gap between the name and the count. Being a <button>,
  // it also works with Tab + Enter.
  return el(
    'button',
    {
      type: 'button',
      className: 'tstb-title-edit',
      title: t('heading.renameHint'),
      'aria-label': t('heading.renameLabel', { name: category.name }),
      onClick: (event) => startRename(event.currentTarget.closest('.tstb-view-heading'), category, actions),
    },
    category.name,
  );
}

function renderDeleteButton(category, actions) {
  // Icon only and discreet: deleting is rare. It stays explicit (never hidden in a click on the
  // title) and asks for confirmation before deleting.
  return el(
    'button',
    {
      type: 'button',
      className: 'tstb-icon-button tstb-icon-button-danger',
      title: t('heading.deleteHint'),
      'aria-label': t('heading.deleteLabel', { name: category.name }),
      onClick: () => actions.remove(category),
    },
    svgIcon(ICONS.delete),
  );
}

function renderSortSelect(sort, actions) {
  const options = [
    el('option', { value: SORT_NAME }, t('heading.sortName')),
    el('option', { value: SORT_RECENT }, t('heading.sortRecent')),
  ];
  const onChange = (event) => actions.setSort(event.target.value);
  const label = t('heading.sort');
  const select = el('select', { className: 'tstb-sort-select', 'aria-label': label, title: label, 'data-focus-key': 'sort', onChange }, options);
  select.value = sort;
  // The icon replaces a text label: the selected option already says what the order is.
  return el('label', { className: 'tstb-sort' }, [svgIcon(ICONS.sort), select]);
}

function renderSelectionHint() {
  // Bulk selection is the quick way to organize, but it isn't obvious; the hint makes it
  // discoverable.
  return el('p', { className: 'tstb-hint' }, t('heading.selectionTip'));
}

function startRename(heading, category, actions) {
  // Editing happens in place of the title, where the new name will appear.
  const input = el('input', { type: 'text', className: 'tstb-rename-input', value: category.name, 'aria-label': t('rename.label'), maxlength: String(CATEGORY_NAME_MAX) });
  const onSubmit = (event) => {
    event.preventDefault();
    actions.rename(category.id, input.value);
  };
  const save = el('button', { type: 'submit', className: 'tstb-button tstb-button-primary' }, t('rename.save'));
  const cancel = el('button', { type: 'button', className: 'tstb-button', onClick: actions.rerender }, t('common.cancel'));
  input.addEventListener('keydown', (event) => event.key === 'Escape' && actions.rerender());
  heading.replaceChildren(el('form', { className: 'tstb-rename', onSubmit }, [input, save, cancel]));
  input.focus();
  input.select();
}
