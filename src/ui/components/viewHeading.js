import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { FILTER_NONE, pluralize, SORT_NAME, SORT_RECENT } from '../view.js';

export function renderViewHeading(state, view, actions, count) {
  const category = state.categories.find((item) => item.id === view.filter);
  const title = category?.name ?? (view.filter === FILTER_NONE ? 'Sem categoria' : 'Todas as inscrições');
  return el('div', { className: 'tstb-view-heading' }, [
    el('h2', { className: 'tstb-view-title' }, [title, el('span', { className: 'tstb-count' }, ` · ${pluralize(count, 'canal', 'canais')}`)]),
    el('div', { className: 'tstb-heading-actions' }, [
      renderSortSelect(view.sort, actions),
      category ? renderCategoryTools(category, actions) : renderSelectionHint(),
    ]),
  ]);
}

// Fica no título da visão porque ordena a lista que está sendo vista, não a coleção inteira.
function renderSortSelect(sort, actions) {
  const options = [
    el('option', { value: SORT_NAME }, 'A–Z'),
    el('option', { value: SORT_RECENT }, 'Vídeo mais recente'),
  ];
  const onChange = (event) => actions.setSort(event.target.value);
  const select = el('select', { className: 'tstb-sort-select', 'data-focus-key': 'sort', onChange }, options);
  select.value = sort;
  return el('label', { className: 'tstb-sort' }, ['Ordenar:', select]);
}

function renderSelectionHint() {
  // A seleção em lote é a forma rápida de organizar, mas não é óbvia; a dica a torna descobrível.
  return el('p', { className: 'tstb-hint' }, 'Dica: marque vários canais (✓) para movê-los de uma vez.');
}

function renderCategoryTools(category, actions) {
  return el('div', { className: 'tstb-tools' }, [
    iconButton(ICONS.edit, 'Renomear', (event) => startRename(event.currentTarget.closest('.tstb-view-heading'), category, actions)),
    iconButton(ICONS.delete, 'Excluir', () => actions.remove(category), 'tstb-button-danger'),
  ]);
}

function iconButton(icon, label, onClick, extraClass = '') {
  return el('button', { type: 'button', className: `tstb-button ${extraClass}`.trim(), onClick }, [svgIcon(icon), label]);
}

function startRename(heading, category, actions) {
  // Edição no próprio título (em vez de window.prompt) mostra o resultado no lugar onde ele vai ficar.
  const input = el('input', { type: 'text', className: 'tstb-rename-input', value: category.name, 'aria-label': 'Novo nome da categoria', maxlength: '40' });
  const onSubmit = (event) => {
    event.preventDefault();
    actions.rename(category.id, input.value);
  };
  const save = el('button', { type: 'submit', className: 'tstb-button tstb-button-primary' }, 'Salvar');
  const cancel = el('button', { type: 'button', className: 'tstb-button', onClick: actions.rerender }, 'Cancelar');
  input.addEventListener('keydown', (event) => event.key === 'Escape' && actions.rerender());
  heading.replaceChildren(el('form', { className: 'tstb-rename', onSubmit }, [input, save, cancel]));
  input.focus();
  input.select();
}
