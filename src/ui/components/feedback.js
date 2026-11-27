import { sortCategoriesByName } from '../../core/categories.js';
import { el } from '../elements.js';
import { localeTag, plural, t } from '../../i18n/i18n.js';

export const TOAST_ID = 'tstb-toast';
// Sentinel value because "" is already used by the "Move to…" title option.
export const MOVE_TO_NONE = '__none__';

export function renderBulkBar(categories, count, actions) {
  const options = [
    el('option', { value: '', disabled: true }, t('bulk.moveTo')),
    ...sortCategoriesByName(categories, localeTag()).map((category) => el('option', { value: category.id }, category.name)),
    el('option', { value: MOVE_TO_NONE }, t('chips.none')),
  ];
  const onChange = (event) => actions.moveSelected(event.target.value === MOVE_TO_NONE ? null : event.target.value);
  const select = el('select', { className: 'tstb-bulk-select', 'aria-label': t('bulk.moveLabel'), onChange }, options);
  select.value = '';
  // Bar fixed at the bottom: it stays visible while the user scrolls and selects more channels.
  return el('div', { className: 'tstb-bulkbar', role: 'region', 'aria-label': t('bulk.region') }, [
    el('span', { className: 'tstb-bulk-count' }, plural('bulk.count', count)),
    select,
    el('button', { type: 'button', className: 'tstb-button tstb-button-text', onClick: actions.clearSelection }, t('common.cancel')),
  ]);
}

export function renderEmptyState({ title, text, action = null }) {
  // An empty state always points to the next step, instead of just saying "nothing here".
  return el('div', { className: 'tstb-empty-state' }, [
    el('h3', {}, title),
    el('p', {}, text),
    action ? el('button', { type: 'button', className: 'tstb-button tstb-button-primary', onClick: action.onClick }, action.label) : null,
  ]);
}

export function showToast(message, { duration = 4000, action = null } = {}) {
  // Outside the Categories page so it survives re-renders.
  document.getElementById(TOAST_ID)?.remove();
  const toast = el('div', { id: TOAST_ID, className: 'tstb-toast', role: 'status' }, [
    el('span', {}, message),
    action ? renderToastAction(action) : null,
  ]);
  toast.querySelector('button')?.addEventListener('click', () => toast.remove());
  document.body.append(toast);
  setTimeout(() => toast.remove(), duration);
  return toast;
}

function renderToastAction(action) {
  // Action in the toast itself (e.g. Undo), like YouTube's/Gmail's snackbar: it appears right when
  // the user notices the result.
  return el('button', { type: 'button', className: 'tstb-toast-action', onClick: action.onClick }, action.label);
}
