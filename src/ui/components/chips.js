import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { t } from '../../i18n/i18n.js';
import { FILTER_ALL, FILTER_NONE } from '../view.js';

// Chips em vez de seções empilhadas: mostram uma categoria por vez. A barra
// quebra linha para que todas as categorias fiquem visíveis de uma vez: aqui
// os chips são a navegação principal, e achar a categoria batendo o olho vale
// mais do que a altura extra (uma versão com rolagem horizontal escondia a
// maioria atrás de setas e deixou a seleção mais lenta).
// "Todas" (visão geral) abre a barra e "Sem categoria" (fila de trabalho) a
// fecha, sempre nas mesmas posições.
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
  // Criar direto na barra mantém o usuário no contexto, sem diálogo modal.
  const button = el('button', { type: 'button', className: 'tstb-chip tstb-chip-new' }, [svgIcon(ICONS.add), t('chips.new')]);
  button.addEventListener('click', () => button.replaceWith(renderNewCategoryForm(actions, button)));
  return button;
}

function renderNewCategoryForm(actions, button) {
  const input = el('input', { type: 'text', className: 'tstb-chip-input', placeholder: t('chips.newPlaceholder'), 'aria-label': t('chips.newLabel'), maxlength: '40' });
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
