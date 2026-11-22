import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { FILTER_ALL, FILTER_NONE } from '../view.js';

const TRACK_SELECTOR = '.tstb-chips-track';
// Quanto cada clique na seta avança: um pouco menos que a largura visível,
// para o último chip visto continuar na tela e servir de referência.
const ARROW_STEP = 0.8;

// Chips em vez de seções empilhadas: é o padrão que o YouTube usa para filtrar
// a página inicial. "Todas" (visão geral) e "Sem categoria" (fila de trabalho)
// ficam fixos nas pontas, sempre visíveis; só as categorias rolam, numa linha
// só, para a barra fixa não ocupar metade da tela com dezenas de categorias.
export function renderChips(chips, activeId, actions) {
  const all = chips.find((chip) => chip.id === FILTER_ALL);
  const none = chips.find((chip) => chip.id === FILTER_NONE);
  const categories = chips.filter((chip) => chip !== all && chip !== none);
  return el('nav', { className: 'tstb-chips', 'aria-label': 'Filtrar por categoria' }, [
    renderChip(all, activeId, actions, { icon: ICONS.grid, className: 'tstb-chip-all' }),
    renderDivider(),
    renderScroller([...categories.map((chip) => renderChip(chip, activeId, actions)), renderNewCategoryChip(actions)]),
    renderDivider(),
    renderChip(none, activeId, actions, { className: 'tstb-chip-pending' }),
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

function renderDivider() {
  return el('span', { className: 'tstb-chips-divider', role: 'separator', 'aria-orientation': 'vertical' });
}

function renderScroller(chipNodes) {
  const track = el('div', { className: 'tstb-chips-track' }, chipNodes);
  const prev = renderArrow('prev', ICONS.chevronLeft, 'Categorias anteriores', () => scrollTrack(track, -1));
  const next = renderArrow('next', ICONS.chevronRight, 'Próximas categorias', () => scrollTrack(track, 1));
  track.addEventListener('scroll', () => updateArrows(track));
  return el('div', { className: 'tstb-chips-scroller' }, [prev, track, next]);
}

function renderArrow(side, icon, label, onClick) {
  // Começam escondidas: só aparecem se updateArrows detectar conteúdo além da borda.
  return el('button', { type: 'button', className: `tstb-chips-arrow tstb-chips-arrow-${side}`, 'aria-label': label, hidden: true, onClick }, svgIcon(icon));
}

function scrollTrack(track, direction) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  track.scrollBy?.({ left: direction * track.clientWidth * ARROW_STEP, behavior: reduceMotion ? 'auto' : 'smooth' });
}

export function updateArrows(track) {
  const scroller = track.parentElement;
  if (!scroller) return;
  const atStart = track.scrollLeft <= 0;
  // -1 absorve arredondamento de pixels fracionários no fim da rolagem.
  const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  scroller.querySelector('.tstb-chips-arrow-prev').hidden = atStart;
  scroller.querySelector('.tstb-chips-arrow-next').hidden = atEnd;
}

// A barra é recriada a cada render; sem isto a rolagem voltaria ao início a
// cada clique. Quando o filtro muda (ex.: categoria recém-criada), o chip
// ativo é trazido para a área visível.
export function preserveChipsScroll(root, render) {
  const previousTrack = root.querySelector(TRACK_SELECTOR);
  const scrollLeft = previousTrack?.scrollLeft ?? 0;
  const previousActive = root.querySelector('.tstb-chip-active')?.dataset.chipId;
  render();
  const track = root.querySelector(TRACK_SELECTOR);
  if (!track) return;
  track.scrollLeft = scrollLeft;
  const active = track.querySelector('.tstb-chip-active');
  if (active && active.dataset.chipId !== previousActive) revealChip(track, active);
  updateArrows(track);
}

function revealChip(track, chip) {
  // Cálculo manual em vez de scrollIntoView, que também rolaria a página na vertical.
  const margin = 48;
  const left = chip.offsetLeft - track.offsetLeft;
  if (left < track.scrollLeft) track.scrollLeft = Math.max(0, left - margin);
  else if (left + chip.offsetWidth > track.scrollLeft + track.clientWidth) {
    track.scrollLeft = left + chip.offsetWidth - track.clientWidth + margin;
  }
}

// Um único listener de janela (em vez de um por render) recalcula as setas
// quando a largura muda e o que cabia deixa de caber, ou vice-versa.
let resizeListening = false;
export function listenForResize() {
  if (resizeListening) return;
  resizeListening = true;
  window.addEventListener('resize', () => {
    const track = document.querySelector(TRACK_SELECTOR);
    if (track) updateArrows(track);
  });
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
