import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';

// Menu próprio para escolher a categoria de um canal. Substitui o <select>
// nativo nos cartões: no Chrome, depois que o menu lateral do YouTube era
// alternado, a lista nativa abria sob o cursor e soltar o botão do mouse já
// escolhia uma opção. Aqui só um clique explícito numa opção escolhe algo.

export const MENU_ID = 'tstb-category-menu';
const GAP = 4;
const VIEWPORT_MARGIN = 8;

let openMenu = null;

// items: [{ id, label, checked }]. onSelect recebe o id escolhido.
export function openCategoryMenu(anchor, { label, items, onSelect }) {
  closeCategoryMenu();
  const menu = el('div', { id: MENU_ID, className: 'tstb-menu', role: 'menu', 'aria-label': label });
  const close = (restoreFocus) => closeCategoryMenu({ restoreFocus });
  menu.append(...items.map((item) => renderItem(item, () => {
    close(true);
    onSelect(item.id);
  })));
  menu.addEventListener('keydown', (event) => handleKeydown(event, menu, close));
  // Fica no <body>, fora da página: não é apagado por re-renderizações nem
  // cortado pela grade.
  document.body.append(menu);
  anchor.setAttribute('aria-expanded', 'true');
  openMenu = { menu, anchor, cleanup: listenForDismiss(menu, anchor, close) };
  positionMenu(menu, anchor);
  (menu.querySelector('[aria-checked="true"]') ?? menu.firstElementChild)?.focus();
  return menu;
}

export function isCategoryMenuOpenFor(anchor) {
  return openMenu?.anchor === anchor;
}

export function closeCategoryMenu({ restoreFocus = false } = {}) {
  if (!openMenu) return;
  const { menu, anchor, cleanup } = openMenu;
  openMenu = null;
  cleanup();
  menu.remove();
  anchor.setAttribute('aria-expanded', 'false');
  if (restoreFocus && anchor.isConnected) anchor.focus();
}

// O cartão que abriu o menu pode sumir num re-render (ex.: fim da
// sincronização); um menu sem âncora ficaria flutuando no lugar errado.
export function closeCategoryMenuIfDetached() {
  if (openMenu && !openMenu.anchor.isConnected) closeCategoryMenu();
}

function renderItem({ label, checked }, choose) {
  return el(
    'button',
    { type: 'button', className: 'tstb-menu-item', role: 'menuitemradio', 'aria-checked': String(checked), tabindex: '-1', onClick: choose },
    [el('span', { className: 'tstb-menu-check' }, checked ? svgIcon(ICONS.check) : null), el('span', {}, label)],
  );
}

function listenForDismiss(menu, anchor, close) {
  // Clique fora fecha sem escolher nada. O clique no próprio gatilho é
  // ignorado aqui: o gatilho já alterna o menu no seu próprio click.
  const onPointerDown = (event) => {
    if (!menu.contains(event.target) && !anchor.contains(event.target)) close(false);
  };
  // Rolar ou redimensionar deslocaria o menu da sua âncora; fechar é mais
  // previsível do que tentar acompanhar.
  const onViewportChange = (event) => {
    // Rolar a lista do próprio menu não conta. O alvo pode ser window ou
    // document (não são elementos), então só usamos contains com Element.
    const insideMenu = event.target instanceof Element && menu.contains(event.target);
    if (!insideMenu) close(false);
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
  };
}

function handleKeydown(event, menu, close) {
  const items = [...menu.querySelectorAll('.tstb-menu-item')];
  const index = items.indexOf(document.activeElement);
  const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
  if (event.key in moves) {
    event.preventDefault();
    items[(moves[event.key] + items.length) % items.length].focus();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    close(true);
  } else if (event.key === 'Tab') {
    close(false);
  }
}

export function positionMenu(menu, anchor) {
  // Posição calculada na hora a partir de onde o gatilho está agora.
  const rect = anchor.getBoundingClientRect();
  const height = menu.offsetHeight;
  const width = menu.offsetWidth;
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  // Abre para baixo; só vira para cima se não couber e houver mais espaço acima.
  const openUp = height > spaceBelow && rect.top > spaceBelow;
  const top = openUp ? rect.top - height - GAP : rect.bottom + GAP;
  const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - width - VIEWPORT_MARGIN);
  menu.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
  menu.style.left = `${Math.max(VIEWPORT_MARGIN, left)}px`;
}
