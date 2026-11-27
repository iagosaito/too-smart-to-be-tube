import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { CATEGORY_NAME_MAX } from '../../core/categories.js';
import { t } from '../../i18n/i18n.js';
import { FILTER_ALL, FILTER_NONE } from '../view.js';

// Chips instead of stacked sections: they show one category at a time. The bar wraps so that every
// category is visible at once: here the chips are the main navigation, and finding a category at a
// glance is worth more than the extra height (a horizontally scrolling version hid most of them
// behind arrows and made selection slower). "All" (overview) opens the bar and "No category" (work
// queue) closes it, always in the same positions.
export function renderChips(chips, activeId, actions) {
  const all = chips.find((chip) => chip.id === FILTER_ALL);
  const none = chips.find((chip) => chip.id === FILTER_NONE);
  const categories = chips.filter((chip) => chip !== all && chip !== none);
  return el('nav', { className: 'tstb-chips', 'aria-label': t('chips.label') }, [
    renderChip(all, activeId, actions, { icon: ICONS.grid, className: 'tstb-chip-all' }),
    ...categories.map((chip) => renderChip(chip, activeId, actions)),
    renderChip(none, activeId, actions, { className: 'tstb-chip-pending' }),
    renderNewCategoryChip(actions),
  ]);
}

function renderChip(chip, activeId, actions, { icon = null, className = '' } = {}) {
  const active = chip.id === activeId;
  return el(
    'button',
    {
      type: 'button',
      className: ['tstb-chip', className, active ? 'tstb-chip-active' : ''].filter(Boolean).join(' '),
      'aria-pressed': String(active),
      'data-chip-id': chip.id,
      'data-focus-key': `chip:${chip.id}`,
      onClick: () => actions.setFilter(chip.id),
    },
    [
      icon ? svgIcon(icon) : null,
      el('span', { className: 'tstb-chip-label' }, chip.label),
      el('span', { className: 'tstb-chip-count' }, String(chip.count)),
    ],
  );
}

function renderNewCategoryChip(actions) {
  // Creating right in the bar keeps the user in context, without a modal dialog.
  const button = el('button', { type: 'button', className: 'tstb-chip tstb-chip-new' }, [svgIcon(ICONS.add), t('chips.new')]);
  button.addEventListener('click', () => button.replaceWith(renderNewCategoryForm(actions, button)));
  return button;
}

function renderNewCategoryForm(actions, button) {
  const input = el('input', { type: 'text', className: 'tstb-chip-input', placeholder: t('chips.newPlaceholder'), 'aria-label': t('chips.newLabel'), maxlength: String(CATEGORY_NAME_MAX) });
  const onSubmit = (event) => {
    event.preventDefault();
    actions.create(input.value);
  };
  const form = el('form', { className: 'tstb-chip tstb-chip-form', onSubmit }, [input]);
  const cancel = () => form.replaceWith(button);
  input.addEventListener('keydown', (event) => event.key === 'Escape' && cancel());
  // Leaving the field empty cancels the creation, like a system rename field.
  input.addEventListener('blur', () => !input.value.trim() && cancel());
  queueMicrotask(() => input.focus());
  return form;
}
