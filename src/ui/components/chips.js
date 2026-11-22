import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';

// Chips em vez de seções empilhadas: é o padrão que o YouTube usa para
// filtrar a página inicial, e mostra uma categoria por vez sem rolagem infinita.
export function renderChips(chips, activeId, actions) {
  return el('nav', { className: 'tstb-chips', 'aria-label': 'Filtrar por categoria' }, [
    ...chips.map((chip) => renderChip(chip, chip.id === activeId, actions)),
    renderNewCategoryChip(actions),
  ]);
}

function renderChip(chip, active, actions) {
  return el(
    'button',
    {
      type: 'button',
      className: active ? 'tstb-chip tstb-chip-active' : 'tstb-chip',
      'aria-pressed': String(active),
      'data-focus-key': `chip:${chip.id}`,
      onClick: () => actions.setFilter(chip.id),
    },
    [chip.label, el('span', { className: 'tstb-chip-count' }, String(chip.count))],
  );
}

function renderNewCategoryChip(actions) {
  // Criar direto na barra mantém o usuário no contexto, sem diálogo modal.
  const button = el('button', { type: 'button', className: 'tstb-chip tstb-chip-new' }, [svgIcon(ICONS.add), 'Nova categoria']);
  button.addEventListener('click', () => button.replaceWith(renderNewCategoryForm(actions, button)));
  return button;
}

function renderNewCategoryForm(actions, button) {
  const input = el('input', { type: 'text', className: 'tstb-chip-input', placeholder: 'Nome e Enter', 'aria-label': 'Nome da nova categoria', maxlength: '40' });
  const onSubmit = (event) => {
    event.preventDefault();
    actions.create(input.value);
  };
  const form = el('form', { className: 'tstb-chip tstb-chip-form', onSubmit }, [input]);
  const cancel = () => form.replaceWith(button);
  input.addEventListener('keydown', (event) => event.key === 'Escape' && cancel());
  // Sair do campo vazio desiste da criação, como num campo de renomear do sistema.
  input.addEventListener('blur', () => !input.value.trim() && cancel());
  queueMicrotask(() => input.focus());
  return form;
}
