import { sortCategoriesByName } from '../../core/categories.js';
import { el } from '../elements.js';
import { localeTag, plural, t } from '../../i18n/i18n.js';

export const TOAST_ID = 'tstb-toast';
// Valor sentinela porque "" já é usado pela opção-título "Mover para…".
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
  // Barra fixa no rodapé: continua visível enquanto o usuário rola e marca mais canais.
  return el('div', { className: 'tstb-bulkbar', role: 'region', 'aria-label': t('bulk.region') }, [
    el('span', { className: 'tstb-bulk-count' }, plural('bulk.count', count)),
    select,
    el('button', { type: 'button', className: 'tstb-button tstb-button-text', onClick: actions.clearSelection }, t('common.cancel')),
  ]);
}

export function renderEmptyState({ title, text, action = null }) {
  // Estado vazio sempre aponta o próximo passo, em vez de só dizer "nada aqui".
  return el('div', { className: 'tstb-empty-state' }, [
    el('h3', {}, title),
    el('p', {}, text),
    action ? el('button', { type: 'button', className: 'tstb-button tstb-button-primary', onClick: action.onClick }, action.label) : null,
  ]);
}

export function showToast(message, { duration = 4000, action = null } = {}) {
  // Fora da página de Categorias para sobreviver às re-renderizações.
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
  // Ação no próprio aviso (ex.: Desfazer), como no snackbar do YouTube/Gmail:
  // aparece no momento em que o usuário percebe o resultado.
  return el('button', { type: 'button', className: 'tstb-toast-action', onClick: action.onClick }, action.label);
}
