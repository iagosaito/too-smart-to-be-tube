import { assignChannel, assignChannels, createCategory, removeCategory, renameCategory } from '../core/categories.js';
import { SELECTORS } from '../dom/selectors.js';
import { closeCategoryMenu, closeCategoryMenuIfDetached } from './components/categoryMenu.js';
import { createCardCache } from './components/channelGrid.js';
import { createFeedCardCache } from './components/feedView.js';
import { FEED_TAB } from '../feed/categoryFeed.js';
import { createFeedController, modelOf } from '../feed/feedController.js';
import { markActiveSidebarCategory } from '../dom/sidebar.js';
import { csvFileName, subscriptionsCsv } from '../export/subscriptionsCsv.js';
import { parseCsv } from '../import/csvParse.js';
import { cachedPlanImport, MAX_IMPORT_BYTES, readImport } from '../import/categorizationImport.js';
import { showToast } from './components/feedback.js';
import { downloadTextFile } from './download.js';
import { pickFile } from './filePicker.js';
import { el, syncChildren } from './elements.js';
import { preserveFocus } from './focus.js';
import { renderPage, SLOTS } from './render.js';
import { describeError } from '../i18n/errors.js';
import { plural, t } from '../i18n/i18n.js';
import { FILTER_ALL, pruneSelection, resolveFilter, SORT_NAME, visibleChannels } from './view.js';

export const PAGE_ID = 'tstb-page';
export const OPEN_CLASS = 'tstb-page-open';
// Espera uma pausa na digitação antes de redesenhar: filtrar a cada tecla
// deixava a digitação travada com muitas inscrições.
const SEARCH_DELAY_MS = 150;
// Um CSV de inscrições tem poucos KB; o limite barra arquivos errados (ex.: um vídeo).
// Tempo maior que o padrão para dar chance de clicar em "Desfazer".
const UNDO_TOAST_MS = 10_000;
// Sincronizar a cada abertura faria dezenas de requisições à toa; uma vez por hora basta.
const AUTO_SYNC_AFTER_MS = 60 * 60 * 1000;

export async function openCategoriesPage(options) {
  const context = createContext(options);
  const page = mountPage();
  if (options.feedSource) {
    context.feed = createFeedController({ source: options.feedSource, onChange: () => scheduleRender(page, context) });
  }
  // A página anterior fica só oculta (não destruída), então um vídeo continuaria tocando.
  document.querySelector('video')?.pause();
  await reload(page, context);
  // Também acompanha uma sincronização já em andamento (aberta por outra
  // instância da página), para mostrar "Sincronizando…" em vez de oferecer outra.
  if (context.sync && (context.sync.isRunning() || needsSync(context.state, context.now()))) runSync(page, context);
  return page;
}

export function closeCategoriesPage() {
  closeCategoryMenu();
  markActiveSidebarCategory(null);
  document.getElementById(PAGE_ID)?.remove();
  document.documentElement.classList.remove(OPEN_CLASS);
}

function needsSync(state, now) {
  // Campos nulos: quem já usava a extensão ainda não tem as datas ou o feed
  // (nem o ucid dos canais), então sincroniza na hora em vez de esperar a
  // próxima hora cheia. Se o feed já foi tentado e falhou, espera a próxima
  // sincronização normal: tentar a cada abertura repetiria ~100 requisições.
  const feedMissing = state.uploadsSyncedAt == null || state.feedSyncedAt == null;
  return isStale(state.lastSyncedAt, now) || (feedMissing && state.feedAttemptedAt == null);
}

function syncCooldownLeft(context) {
  return context.sync ? Math.max(0, context.sync.availableAt() - context.now()) : 0;
}

export function isStale(lastSyncedAt, now) {
  return lastSyncedAt == null || now - lastSyncedAt > AUTO_SYNC_AFTER_MS;
}

function createContext(options) {
  return {
    confirm: (message) => window.confirm(message),
    download: downloadTextFile,
    pickFile,
    now: Date.now,
    searchDelay: SEARCH_DELAY_MS,
    ...options,
    state: null,
    cardCache: createCardCache(),
    feedCardCache: createFeedCardCache(),
    feed: null,
    feedSession: null,
    renderQueued: false,
    searchTimer: null,
    cooldownTimer: null,
    // Estado só de tela (filtro, busca, seleção): não é salvo, como a busca do próprio YouTube.
    view: {
      filter: options.initialFilter ?? FILTER_ALL,
      // Assistir vem antes de organizar: categorias abrem nos vídeos.
      tab: options.initialTab ?? FEED_TAB.VIDEOS,
      query: '',
      sort: null,
      selected: new Set(),
      syncing: false,
      syncError: '',
      pendingImport: null,
    },
  };
}

function mountPage() {
  closeCategoriesPage();
  const slots = SLOTS.map((name) => el('div', { className: 'tstb-slot', 'data-slot': name }));
  const page = el('div', { id: PAGE_ID, className: 'tstb-page', role: 'main' }, slots);
  // Dentro do ytd-page-manager herdamos as margens do cabeçalho e do menu
  // lateral, então a página se encaixa no layout do YouTube sem CSS frágil.
  (document.querySelector(SELECTORS.pageManager) ?? document.body).append(page);
  document.documentElement.classList.add(OPEN_CLASS);
  window.scrollTo?.(0, 0);
  return page;
}

async function reload(page, context) {
  // O storage é a fonte da verdade; recarregar após cada gravação evita estado divergente.
  context.state = await context.store.load();
  // A ordem escolhida é lembrada entre visitas; só é lida do storage na primeira carga.
  context.view.sort ??= context.state.preferences.sortBy ?? SORT_NAME;
  render(page, context);
}

function render(page, context) {
  if (!page.isConnected) return;
  context.view.filter = resolveFilter(context.view.filter, context.state.categories);
  context.view.selected = pruneSelection(context.view.selected, visibleChannels(context.state, context.view));
  context.view.syncCoolingDown = syncCooldownLeft(context) > 0;
  scheduleCooldownEnd(page, context);
  const now = context.now();
  const env = { now, cardCache: context.cardCache, feed: feedEnvFor(context, now) };
  const parts = renderPage(context.state, context.view, createActions(page, context), env);
  markActiveSidebarCategory(context.state.categories.some((category) => category.id === context.view.filter) ? context.view.filter : null);
  preserveFocus(page, () => fillSlots(page, parts));
  closeCategoryMenuIfDetached();
}

function fillSlots(page, parts) {
  for (const slot of page.children) syncChildren(slot, parts[slot.dataset.slot] ? [parts[slot.dataset.slot]] : []);
}

function feedEnvFor(context, now) {
  const { state, view } = context;
  const category = state.categories.find((item) => item.id === view.filter);
  if (!context.feed || !category || view.tab === FEED_TAB.CHANNELS) {
    context.feedSession = null;
    return null;
  }
  const channels = category.channelIds.map((id) => state.channels[id]).filter(Boolean);
  context.feedSession = context.feed.sessionFor(category, view.tab, channels, state.latestUploads);
  return { tab: view.tab, model: modelOf(context.feedSession, state.feedItems), channelsById: state.channels, now, cache: context.feedCardCache, query: view.query };
}

function scheduleRender(page, context) {
  // Vários canais de um lote terminam quase juntos: um redesenho só para todos.
  if (context.renderQueued) return;
  context.renderQueued = true;
  queueMicrotask(() => {
    context.renderQueued = false;
    render(page, context);
  });
}

function scheduleCooldownEnd(page, context) {
  // Redesenha quando o intervalo acaba, para o botão reabilitar sozinho.
  clearTimeout(context.cooldownTimer);
  const left = syncCooldownLeft(context);
  if (left > 0) context.cooldownTimer = setTimeout(() => render(page, context), left);
}

async function runSync(page, context) {
  Object.assign(context.view, { syncing: true, syncError: '' });
  render(page, context);
  try {
    await context.sync.sync();
  } catch (error) {
    context.view.syncError = describeError(error);
  }
  context.view.syncing = false;
  await reload(page, context);
}

function createActions(page, context) {
  return {
    ...viewActions(page, context),
    ...dataActions(page, context),
    sync: () => runSync(page, context),
    hasFeed: Boolean(context.feed),
    loadMore: () => context.feedSession && context.feed.loadMore(context.feedSession),
    canSync: Boolean(context.sync),
    exportCsv: () => exportSubscriptions(context),
    importCsv: () => startImport(page, context),
    applyImport: () => applyImport(page, context),
  };
}

function viewActions(page, context) {
  const update = (changes) => {
    Object.assign(context.view, changes);
    render(page, context);
  };
  return {
    // Trocar de categoria limpa a seleção para não mover canais que o usuário já não vê.
    setFilter: (filter) => update({ filter, selected: new Set() }),
    search: (query) => update({ query }),
    searchAsYouType: (query) => scheduleSearch(page, context, query),
    isSelecting: () => context.view.selected.size > 0,
    setSort: (sort) => {
      update({ sort });
      // Gravar a preferência não precisa bloquear a tela; uma falha só faz a ordem não ser lembrada.
      context.store.savePreferences({ sortBy: sort }).catch(() => {});
    },
    toggleSelect: (channelId) => update({ selected: toggled(context.view.selected, channelId) }),
    clearSelection: () => update({ selected: new Set() }),
    rerender: () => update({}),
    cancelImport: () => update({ pendingImport: null }),
    // Trocar de aba limpa a seleção: ela só existe na lista de canais.
    setTab: (tab) => update({ tab, selected: new Set() }),
  };
}

function scheduleSearch(page, context, query) {
  // A consulta é gravada já, e só o redesenho espera: assim um re-render
  // vindo de outra ação (ex.: fim da sincronização) não apaga o que foi digitado.
  context.view.query = query;
  clearTimeout(context.searchTimer);
  context.searchTimer = setTimeout(() => render(page, context), context.searchDelay);
}

async function saveCategories(page, context, next, viewChanges = {}) {
  await context.store.saveCategories(next);
  Object.assign(context.view, viewChanges);
  await reload(page, context);
}

function dataActions(page, context) {
  const categories = () => context.state.categories;
  const save = (next, viewChanges) => saveCategories(page, context, next, viewChanges);
  return {
    create: (name) => createAndOpen(categories(), name, save),
    rename: (categoryId, name) => save(renameCategory(categories(), categoryId, name)),
    remove: (category) => removeWithConfirmation(context, category, save),
    assign: (channelId, categoryId) => save(assignChannel(categories(), channelId, categoryId)),
    moveSelected: (categoryId) => moveSelection(context, categoryId, save),
  };
}

async function createAndOpen(categories, name, save) {
  const next = createCategory(categories, name);
  // Abrir a categoria recém-criada leva o usuário direto ao próximo passo: preenchê-la.
  const created = next.length > categories.length ? next.at(-1) : null;
  await save(next, created ? { filter: created.id, selected: new Set() } : {});
}

async function removeWithConfirmation(context, category, save) {
  const count = category.channelIds.length;
  const detail = count ? ` ${plural('confirm.deleteDetail', count, { none: t('chips.none') })}` : '';
  // Confirmação porque excluir não tem "desfazer" e desfaz trabalho manual de organização.
  if (!context.confirm(`${t('confirm.delete', { name: category.name })}${detail}`)) return;
  await save(removeCategory(context.state.categories, category.id), { filter: FILTER_ALL });
  showToast(t('toast.categoryDeleted', { name: category.name }));
}

async function moveSelection(context, categoryId, save) {
  const ids = [...context.view.selected];
  const target = context.state.categories.find((category) => category.id === categoryId)?.name ?? t('chips.none');
  await save(assignChannels(context.state.categories, ids, categoryId), { selected: new Set() });
  showToast(plural('toast.moved', ids.length, { target }));
}

function exportSubscriptions(context) {
  // Exporta do estado salvo (não da tela), então filtro e busca não afetam o arquivo.
  const { state } = context;
  context.download(csvFileName(context.now()), subscriptionsCsv(state));
  const count = Object.keys(state.channels).length;
  showToast(plural('toast.exported', count));
}

async function startImport(page, context) {
  const file = await context.pickFile();
  if (!file) return;
  context.view.pendingImport = await readImportFile(file);
  render(page, context);
  // Leva foco e leitores de tela direto ao resultado da ação que o usuário acabou de fazer.
  page.querySelector('.tstb-review h3')?.focus();
}

async function readImportFile(file) {
  // error é uma chave de tradução, como os erros de readImport.
  if (file.size > MAX_IMPORT_BYTES) return { fileName: file.name, error: 'import.tooLarge' };
  const { entries, error } = readImport(parseCsv(await file.text()));
  return { fileName: file.name, entries: error ? null : entries, error };
}

async function applyImport(page, context) {
  const previous = context.state.categories;
  // Mesmo plano (do cache) que a revisão mostra agora, calculado com o estado atual.
  const { categories, summary } = cachedPlanImport(context.state, context.view.pendingImport.entries);
  // A revisão já esconde o botão nesses casos; a checagem aqui garante que nada
  // fora do limite seja gravado mesmo se a ação for chamada por outro caminho.
  if (summary.error || !summary.matched) return;
  await saveCategories(page, context, categories, { pendingImport: null, filter: FILTER_ALL, selected: new Set() });
  const undo = () => saveCategories(page, context, previous);
  const message = t('import.summary', { channels: plural('import.organized', summary.matched), categories: plural('import.categories', summary.categoryCount) });
  showToast(message, { duration: UNDO_TOAST_MS, action: { label: t('common.undo'), onClick: undo } });
}

function toggled(set, value) {
  // Novo Set em vez de mutar: o estado de tela é tratado como imutável, como o resto.
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
