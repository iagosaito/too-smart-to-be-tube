import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { FILTER_NONE, pluralize, SORT_NAME, SORT_RECENT } from '../view.js';

// Duas zonas separadas pelo objeto em que agem: à esquerda, a categoria
// (nome editável e excluir); à direita, a lista (ordenar). Excluir ao lado de
// Ordenar misturava uma ação rara e destrutiva com um controle de uso frequente.
export function renderViewHeading(state, view, actions, count) {
  const category = state.categories.find((item) => item.id === view.filter);
  return el('div', { className: 'tstb-view-heading' }, [
    el('div', { className: 'tstb-title-group' }, [
      renderTitle(category, view, count, actions),
      category ? renderDeleteButton(category, actions) : null,
    ]),
    el('div', { className: 'tstb-heading-actions' }, [
      renderSortSelect(view.sort, actions),
      category ? null : renderSelectionHint(),
    ]),
  ]);
}

function renderTitle(category, view, count, actions) {
  const countLabel = el('span', { className: 'tstb-count' }, ` · ${pluralize(count, 'canal', 'canais')}`);
  if (!category) {
    const title = view.filter === FILTER_NONE ? 'Sem categoria' : 'Todas as inscrições';
    return el('h2', { className: 'tstb-view-title' }, [title, countLabel]);
  }
  return el('h2', { className: 'tstb-view-title' }, [renderEditableName(category, actions), countLabel]);
}

function renderEditableName(category, actions) {
  // Renomear clicando no próprio nome (como o título de um documento no
  // Notion/Docs) dispensa um botão para uma ação rara. Só o fundo e o cursor de
  // texto no hover indicam que é editável: um lápis escondido reservava espaço
  // e deixava um buraco entre o nome e a contagem. Sendo <button>, também
  // funciona por Tab + Enter.
  return el(
    'button',
    {
      type: 'button',
      className: 'tstb-title-edit',
      title: 'Clique para renomear',
      'aria-label': `Renomear categoria ${category.name}`,
      onClick: (event) => startRename(event.currentTarget.closest('.tstb-view-heading'), category, actions),
    },
    category.name,
  );
}

function renderDeleteButton(category, actions) {
  // Só ícone e discreto: excluir é raro. Continua explícito (nunca escondido
  // num clique no título) e pede confirmação antes de apagar.
  return el(
    'button',
    {
      type: 'button',
      className: 'tstb-icon-button tstb-icon-button-danger',
      title: 'Excluir categoria',
      'aria-label': `Excluir categoria ${category.name}`,
      onClick: () => actions.remove(category),
    },
    svgIcon(ICONS.delete),
  );
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

function startRename(heading, category, actions) {
  // A edição acontece no lugar do título, onde o nome novo vai aparecer.
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
