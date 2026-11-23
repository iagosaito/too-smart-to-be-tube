import { scrapeChannels } from '../dom/scraper.js';
import { SELECTORS } from '../dom/selectors.js';
import { keepMiniGuideEntry, keepSidebarEntry, setSidebarCategories } from '../dom/sidebar.js';
import { sortCategoriesByName } from '../core/categories.js';
import { createChannelTabCache } from '../feed/channelTabCache.js';
import { createFeedSource } from '../feed/feedSource.js';
import { localeTag } from '../i18n/i18n.js';
import { createRequestQueue } from '../sync/requestQueue.js';
import { clientVersionFromDocument } from '../youtube/pageData.js';
import { waitFor } from '../dom/waitFor.js';
import { createStore } from '../storage/store.js';
import { showToast } from '../ui/components/feedback.js';
import { closeCategoriesPage, openCategoriesPage } from '../ui/page.js';
import { t } from '../i18n/i18n.js';
import { createSyncCoordinator } from '../sync/syncCoordinator.js';
import { runIfAlive } from './extensionContext.js';
import { fetchSubscriptionFeed, latestByChannel } from '../youtube/recentUploads.js';
import { fetchAllSubscriptions } from '../youtube/subscriptions.js';

const store = createStore(chrome.storage.local);

async function syncFromDom() {
  const channels = scrapeChannels(document);
  // Não grava nada quando a leitura vem vazia (DOM ainda carregando).
  if (channels.length) await store.mergeChannels(channels);
}

async function syncAllSubscriptions() {
  const channels = await fetchAllSubscriptions();
  await store.replaceChannels(channels);
  await syncLatestUploads();
  return channels.length;
}

// Um coordenador por aba, compartilhado por todas as páginas de Categorias
// abertas nela: cliques repetidos não disparam sincronizações em paralelo.
const syncCoordinator = createSyncCoordinator(syncAllSubscriptions);

async function syncLatestUploads() {
  // O feed de Inscrições é um extra: se falhar, a lista de inscrições (já
  // salva) continua valendo e o erro não deve derrubar a sincronização.
  try {
    const videos = await fetchSubscriptionFeed();
    // Os mesmos vídeos alimentam a data do último vídeo de cada canal e o feed
    // por categoria (aba Vídeos), sem nenhuma requisição a mais.
    await store.saveUploads(latestByChannel(videos));
    await store.saveFeed(videos);
  } catch (error) {
    console.warn('[Too Smart To Be Tube] Could not read the subscriptions feed:', error);
  } finally {
    await store.markFeedAttempt();
  }
}

// Fonte do feed por categoria, uma por aba: cache persistido e uma fila que
// controla o ritmo das consultas públicas aos canais. A pausa e o teto da
// fila ficam no storage, valendo para todas as abas do YouTube abertas.
const feedSource = createFeedSource({
  cache: createChannelTabCache({ storage: store.channelTabStorage }),
  queue: createRequestQueue({ shared: { load: store.loadRequestBudget, save: store.saveRequestBudget } }),
  clientVersion: () => clientVersionFromDocument(document),
});

async function openCategories(options = {}) {
  // A leitura do DOM é instantânea e já mostra algo enquanto a sincronização
  // completa (várias requisições) roda em segundo plano.
  await runIfAlive(async () => {
    await syncFromDom();
    await openCategoriesPage({ store, sync: syncCoordinator, feedSource, ...options });
  }, warnOrphaned);
}

// Clicar numa categoria no menu lateral abre direto o feed dela.
const openCategoryFeed = (categoryId) => openCategories({ initialFilter: categoryId });

async function refreshSidebarCategories(categories) {
  const list = categories ?? (await store.load()).categories;
  setSidebarCategories(sortCategoriesByName(list, localeTag()), openCategoryFeed);
}

function warnOrphaned() {
  // Só avisamos quando o usuário clica: em tarefas de fundo seria um alerta
  // sem contexto a cada navegação.
  closeCategoriesPage();
  showToast(t('toast.extensionUpdated'), {
    duration: 15_000,
    action: { label: t('common.reload'), onClick: () => window.location.reload() },
  });
}

function stopBackgroundWork() {
  // Script órfão: para de reagir às navegações. O próximo carregamento da
  // página injeta o script novo da extensão.
  document.removeEventListener('yt-navigate-finish', setup);
}

// Os menus podem só ser montados muito depois do carregamento (ex.: numa
// janela estreita o menu expandido só existe quando o usuário abre o ☰).
// Cada espera é iniciada uma vez; depois disso o observer do menu mantém o
// item no lugar.
const waiting = new Set();
// Sem o contêiner do menu, a espera vigia o documento inteiro: com prazo,
// para não rodar a cada mutação da página (inclusive durante um vídeo).
// A próxima navegação tenta de novo.
const DOCUMENT_WAIT_MS = 10_000;

async function whenPresent(selector, keep, scopeSelector) {
  const current = document.querySelector(selector);
  // Se o YouTube recriou o menu inteiro, este é um elemento novo: passa a ser observado.
  if (current) return keep(current);
  if (waiting.has(selector)) return;
  waiting.add(selector);
  try {
    keep(await waitFor(selector, waitScope(scopeSelector)));
  } catch {
    // Prazo esgotado sem o menu: nada a fazer até a próxima navegação.
  } finally {
    waiting.delete(selector);
  }
}

function waitScope(scopeSelector) {
  // Dentro do contêiner do menu as mutações são raras, então dá para esperar
  // sem prazo pelo momento em que o usuário abrir o menu.
  const scope = document.querySelector(scopeSelector);
  return scope ? { root: scope, timeout: null } : { timeout: DOCUMENT_WAIT_MS };
}

function setupMenus() {
  whenPresent(SELECTORS.miniGuideItems, (items) => keepMiniGuideEntry(items, openCategories), SELECTORS.miniGuide);
  // Espera uma seção, não só o ytd-guide-renderer, porque ele existe vazio
  // antes de o YouTube preencher o menu.
  whenPresent(SELECTORS.guideSection, (section) => keepSidebarEntry(section.closest(SELECTORS.guide) ?? section.parentElement, openCategories), SELECTORS.guideDrawer);
}

async function setup() {
  setupMenus();
  runIfAlive(refreshSidebarCategories, stopBackgroundWork);
  await runIfAlive(syncFromDom, stopBackgroundWork);
}

// O YouTube é SPA: o content script roda uma vez, mas a página muda sem
// recarregar. Estes são os eventos que o próprio site dispara a cada troca;
// fechar no início da navegação faz a página de Categorias se comportar como
// qualquer outra página do YouTube.
document.addEventListener('yt-navigate-start', closeCategoriesPage);
document.addEventListener('yt-navigate-finish', setup);
setup();

// Mantém a lista do menu lateral em dia quando as categorias mudam (inclusive
// por outra aba do YouTube aberta ao mesmo tempo).
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area === 'local' && changes.categories) refreshSidebarCategories(changes.categories.newValue ?? []);
});
