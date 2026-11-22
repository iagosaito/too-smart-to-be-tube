import { sortCategoriesByName } from '../../core/categories.js';
import { el, svgIcon, syncChildren } from '../elements.js';
import { ICONS } from '../icons.js';

// Cada interação re-renderiza a página inteira (simples de manter), mas
// recriar centenas de cartões com imagem e select a cada clique travava a UI.
// O cache devolve o mesmo nó DOM quando nada daquele cartão mudou, então o
// navegador não recria nem recarrega as imagens.
export function createCardCache() {
  return { cards: new Map(), list: null };
}

// metaOf devolve a linha de apoio do cartão (ex.: "Vídeo há 2 dias") ou null.
export function renderChannelGrid(channels, { categories, view, actions, cache = createCardCache(), metaOf = () => null }) {
  // As opções do select seguem a mesma ordem A–Z dos chips.
  const sorted = sortCategoriesByName(categories);
  const shared = { categories: sorted, actions, metaOf, categoryOf: mapCategoryByChannel(sorted), categoriesKey: keyOf(sorted) };
  const cards = channels.map((channel) => cachedCard(channel, view.selected.has(channel.id), shared, cache.cards));
  // A mesma <ul> é reaproveitada para que só os cartões alterados sejam trocados no DOM.
  cache.list ??= el('ul');
  cache.list.className = view.selected.size ? 'tstb-grid tstb-selecting' : 'tstb-grid';
  syncChildren(cache.list, cards);
  return cache.list;
}

function cachedCard(channel, selected, shared, cache) {
  const categoryId = shared.categoryOf.get(channel.id) ?? '';
  const meta = shared.metaOf(channel);
  // Tudo o que aparece no cartão entra na chave; se algo mudar, ele é recriado.
  const key = [channel.name, channel.avatar, categoryId, selected, meta, shared.categoriesKey].join('\u0000');
  const cached = cache.get(channel.id);
  if (cached?.key === key) return cached.node;
  const node = renderCard(channel, { ...shared, categoryId, selected, meta });
  cache.set(channel.id, { key, node });
  return node;
}

function mapCategoryByChannel(categories) {
  // Um Map evita procurar o canal em todas as categorias para cada cartão.
  const map = new Map();
  categories.forEach((category) => category.channelIds.forEach((id) => map.set(id, category.id)));
  return map;
}

function keyOf(categories) {
  // As opções do select dependem dos nomes das categorias; renomear deve invalidar o cache.
  return categories.map((category) => `${category.id}=${category.name}`).join('|');
}

function renderCard(channel, options) {
  return el('li', { className: options.selected ? 'tstb-card tstb-card-selected' : 'tstb-card' }, [
    renderCheck(channel, options),
    renderCardLink(channel, options.actions, options.meta),
    renderCategoryPill(channel, options),
  ]);
}

function renderCheck(channel, { selected, actions }) {
  return el(
    'button',
    {
      type: 'button',
      className: 'tstb-check',
      role: 'checkbox',
      'aria-checked': String(selected),
      'aria-label': `Selecionar ${channel.name}`,
      'data-focus-key': `check:${channel.id}`,
      onClick: () => actions.toggleSelect(channel.id),
    },
    svgIcon(ICONS.check),
  );
}

function renderCardLink(channel, actions, meta) {
  // Em modo de seleção o clique no cartão seleciona (como no Google Fotos),
  // evitando sair da página sem querer no meio da organização. A consulta é
  // feita na hora do clique para que cartões em cache não guardem um modo antigo.
  const onClick = (event) => {
    if (!actions.isSelecting()) return;
    event.preventDefault();
    actions.toggleSelect(channel.id);
  };
  return el('a', { className: 'tstb-card-link', href: channel.url, title: channel.name, onClick }, [
    renderAvatar(channel),
    el('span', { className: 'tstb-card-name' }, channel.name),
    meta ? el('span', { className: 'tstb-card-meta' }, meta) : null,
  ]);
}

function renderAvatar(channel) {
  if (channel.avatar) {
    // decoding async tira a decodificação da imagem da thread principal.
    return el('img', { className: 'tstb-avatar', src: channel.avatar, alt: '', loading: 'lazy', decoding: 'async' });
  }
  // Inicial como substituto para canais lidos antes de o avatar carregar.
  return el('div', { className: 'tstb-avatar tstb-avatar-empty', 'aria-hidden': 'true' }, channel.name.charAt(0));
}

function renderCategoryPill(channel, { categories, categoryId, actions }) {
  const options = [{ id: '', name: 'Sem categoria' }, ...categories].map(({ id, name }) => el('option', { value: id }, name));
  const select = el(
    'select',
    {
      // Estilo diferente para "Sem categoria" destaca o que ainda falta organizar.
      className: categoryId ? 'tstb-pill' : 'tstb-pill tstb-pill-empty',
      'aria-label': `Categoria de ${channel.name}`,
      'data-focus-key': `pill:${channel.id}`,
      onChange: (event) => actions.assign(channel.id, event.target.value || null),
    },
    options,
  );
  // value só pode ser definido depois que as opções existem.
  select.value = categoryId;
  return select;
}
