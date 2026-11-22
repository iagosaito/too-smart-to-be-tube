import { el, svgIcon } from '../ui/elements.js';
import { t } from '../i18n/i18n.js';
import { ICONS } from '../ui/icons.js';
import { SELECTORS } from './selectors.js';

export const ENTRY_ID = 'tstb-sidebar-entry';
export const MINI_ENTRY_ID = 'tstb-mini-entry';

export function injectSidebarEntry(guide, onClick) {
  // A navegação SPA dispara a injeção várias vezes; sem esta checagem o item duplicaria.
  const existing = guide.querySelector(`#${ENTRY_ID}`);
  if (existing) return existing;

  const firstSection = guide.querySelector(SELECTORS.guideSection);
  if (!firstSection) return null;

  // Inserido como irmão da seção, e não dentro da lista de itens, porque o
  // Polymer do YouTube re-renderiza essas listas e apagaria nosso nó.
  const entry = el('div', { id: ENTRY_ID, className: 'tstb-sidebar-entry' }, buildButton('tstb-sidebar-button', onClick));
  firstSection.after(entry);
  return entry;
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

function buildButton(className, onClick) {
  // <button> em vez de <a href="#">: não é navegação, e assim ganha teclado/acessibilidade de graça.
  return el('button', { type: 'button', className, onClick }, [
    svgIcon(ICONS.folder),
    el('span', { className: 'tstb-sidebar-label' }, t('app.title')),
  ]);
}
