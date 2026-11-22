import { el, svgIcon } from '../ui/elements.js';
import { t } from '../i18n/i18n.js';
import { ICONS } from '../ui/icons.js';
import { SELECTORS } from './selectors.js';

export const ENTRY_ID = 'tstb-sidebar-entry';
export const MINI_ENTRY_ID = 'tstb-mini-entry';

// Quantas categorias aparecem antes de "Mostrar mais": o mesmo limite que o
// YouTube usa na lista de Inscrições do menu, para parecer nativo.
export const SIDEBAR_VISIBLE_CATEGORIES = 7;
const LIST_CLASS = 'tstb-sidebar-categories';

// Estado da lista no menu, compartilhado por todas as reinserções: o YouTube
// recria o menu, e a lista precisa voltar igual (mesmas categorias, aberta ou não).
const sidebarModel = { categories: [], onOpenCategory: null, expanded: false, activeId: null };

export function injectSidebarEntry(guide, onClick) {
  // A navegação SPA dispara a injeção várias vezes; sem esta checagem o item duplicaria.
  const existing = guide.querySelector(`#${ENTRY_ID}`);
  if (existing) return existing;

  const firstSection = guide.querySelector(SELECTORS.guideSection);
  if (!firstSection) return null;

  // Inserido como irmão da seção, e não dentro da lista de itens, porque o
  // Polymer do YouTube re-renderiza essas listas e apagaria nosso nó.
  const entry = el('div', { id: ENTRY_ID, className: 'tstb-sidebar-entry' }, [buildSectionHeader(onClick), renderCategoryList()]);
  firstSection.after(entry);
  return entry;
}

// Atualiza a lista de categorias do menu (ex.: categoria criada ou renomeada).
export function setSidebarCategories(categories, onOpenCategory) {
  Object.assign(sidebarModel, { categories, onOpenCategory });
  refreshCategoryList();
}

// Destaca a categoria aberta, como o YouTube destaca a página atual.
export function markActiveSidebarCategory(categoryId) {
  if (sidebarModel.activeId === categoryId) return;
  sidebarModel.activeId = categoryId;
  // Com uma categoria aberta, o destaque fica nela, não no título "Categorias".
  document.documentElement.classList.toggle('tstb-category-open', Boolean(categoryId));
  refreshCategoryList();
}

function refreshCategoryList() {
  document.querySelector(`#${ENTRY_ID} .${LIST_CLASS}`)?.replaceWith(renderCategoryList());
}

function renderCategoryList() {
  const { categories, expanded } = sidebarModel;
  const visible = expanded ? categories : categories.slice(0, SIDEBAR_VISIBLE_CATEGORIES);
  const items = visible.map(renderCategoryItem);
  if (categories.length > SIDEBAR_VISIBLE_CATEGORIES) items.push(renderToggle(expanded));
  return el('ul', { className: LIST_CLASS }, items);
}

function renderCategoryItem(category) {
  const active = category.id === sidebarModel.activeId;
  const onClick = () => sidebarModel.onOpenCategory?.(category.id);
  return el('li', {}, el('button', {
    type: 'button',
    className: active ? 'tstb-sidebar-category tstb-sidebar-category-active' : 'tstb-sidebar-category',
    'aria-current': active ? 'page' : null,
    title: category.name,
    onClick,
  }, [svgIcon(ICONS.folder), el('span', { className: 'tstb-sidebar-label' }, category.name)]));
}

function renderToggle(expanded) {
  const onClick = () => {
    sidebarModel.expanded = !expanded;
    refreshCategoryList();
  };
  return el('li', {}, el('button', { type: 'button', className: 'tstb-sidebar-category tstb-sidebar-toggle', 'aria-expanded': String(expanded), onClick }, [
    svgIcon(expanded ? ICONS.chevronUp : ICONS.chevronDown),
    el('span', { className: 'tstb-sidebar-label' }, expanded ? t('sidebar.showLess') : t('sidebar.showMore')),
  ]));
}

// O menu recolhido é outro componente do YouTube (ícone em cima, rótulo
// embaixo), então ganha um item próprio com o mesmo comportamento.
export function injectMiniGuideEntry(items, onClick) {
  const existing = items.querySelector(`#${MINI_ENTRY_ID}`);
  if (existing) return existing;

  // Aqui entramos dentro da lista nativa: fora dela o item ficava num
  // contêiner com outro espaçamento e saía desalinhado. Se o Polymer
  // re-renderizar a lista, a próxima navegação reinsere o item.
  const entry = el('div', { id: MINI_ENTRY_ID, className: 'tstb-mini-entry' }, buildButton('tstb-mini-button', onClick));
  const reference = findMiniGuideSlot(items);
  // Insere no pai real da referência: se o YouTube aninhar os itens numa
  // camada extra, items.insertBefore lançaria erro e o item não apareceria.
  (reference?.parentNode ?? items).insertBefore(entry, reference);
  return entry;
}

// O YouTube redesenha os menus (ao expandir/recolher, ao atualizar as
// inscrições) e remove nós que não são dele. Um observer por menu reinsere o
// item quando ele some; inserir dispara o observer de novo, mas aí o item já
// existe e nada acontece. O WeakSet evita empilhar observers no mesmo menu a
// cada navegação.
const keptMenus = new WeakSet();

function keepEntry(container, inject, options) {
  inject();
  if (keptMenus.has(container)) return null;
  keptMenus.add(container);
  const observer = new MutationObserver(inject);
  observer.observe(container, options);
  return observer;
}

export function keepMiniGuideEntry(items, onClick) {
  // Só os filhos diretos: a lista do menu recolhido é plana.
  return keepEntry(items, () => injectMiniGuideEntry(items, onClick), { childList: true });
}

export function keepSidebarEntry(guide, onClick) {
  // Subtree porque o YouTube recria as seções dentro de #sections, e não o
  // guide inteiro. O callback só faz uma busca por id quando nada mudou.
  return keepEntry(guide, () => injectSidebarEntry(guide, onClick), { childList: true, subtree: true });
}

function findMiniGuideSlot(items) {
  const entryOf = (selector) => items.querySelector(selector)?.closest(SELECTORS.miniGuideEntry) ?? null;
  const subscriptions = entryOf(SELECTORS.miniGuideSubscriptions);
  if (subscriptions) return subscriptions;
  // Sem "Inscrições" (ex.: deslogado), fica logo após o Shorts; sem ambos, no fim (null).
  return entryOf(SELECTORS.miniGuideShorts)?.nextElementSibling ?? null;
}

// No menu expandido o item vira título de seção ("Categorias ›"), no mesmo
// estilo de "Inscrições ›" e "Você ›": deixa claro que as categorias abaixo
// pertencem a ele e que clicar no título abre a página de organizar.
function buildSectionHeader(onClick) {
  return el('button', { type: 'button', className: 'tstb-sidebar-button tstb-sidebar-header', onClick }, [
    el('span', { className: 'tstb-sidebar-label' }, t('app.title')),
    svgIcon(ICONS.chevronRight),
  ]);
}

function buildButton(className, onClick) {
  // <button> em vez de <a href="#">: não é navegação, e assim ganha teclado/acessibilidade de graça.
  return el('button', { type: 'button', className, onClick }, [
    svgIcon(ICONS.folder),
    el('span', { className: 'tstb-sidebar-label' }, t('app.title')),
  ]);
}
