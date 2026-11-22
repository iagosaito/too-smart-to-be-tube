import { scrapeChannels } from '../dom/scraper.js';
import { SELECTORS } from '../dom/selectors.js';
import { keepMiniGuideEntry, keepSidebarEntry } from '../dom/sidebar.js';
import { waitFor } from '../dom/waitFor.js';
import { createStore } from '../storage/store.js';
import { showToast } from '../ui/components/feedback.js';
import { closeCategoriesPage, openCategoriesPage } from '../ui/page.js';
import { t } from '../i18n/i18n.js';
import { runIfAlive } from './extensionContext.js';
import { fetchLatestUploads } from '../youtube/recentUploads.js';
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

async function syncLatestUploads() {
  // A data dos vídeos é um extra: se o feed falhar, a lista de inscrições
  // (já salva) continua valendo e o erro não deve derrubar a sincronização.
  try {
    await store.saveUploads(await fetchLatestUploads());
  } catch (error) {
    console.warn('[Too Smart To Be Tube] Could not read the subscriptions feed:', error);
  }
}

async function openCategories() {
  // A leitura do DOM é instantânea e já mostra algo enquanto a sincronização
  // completa (várias requisições) roda em segundo plano.
  await runIfAlive(async () => {
    await syncFromDom();
    await openCategoriesPage({ store, sync: syncAllSubscriptions });
  }, warnOrphaned);
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

// Os menus podem só ser montados muito depois do carregamento (ex.: a página
// abre com o menu recolhido e o usuário expande depois), por isso a espera
// não tem timeout. Cada espera é iniciada uma vez; depois disso o observer
// do menu mantém o item no lugar.
const waiting = new Set();

async function whenPresent(selector, keep) {
  const current = document.querySelector(selector);
  // Se o YouTube recriou o menu inteiro, este é um elemento novo: passa a ser observado.
  if (current) return keep(current);
  if (waiting.has(selector)) return;
  waiting.add(selector);
  keep(await waitFor(selector, { timeout: null }));
  waiting.delete(selector);
}

function setupMenus() {
  whenPresent(SELECTORS.miniGuideItems, (items) => keepMiniGuideEntry(items, openCategories));
  // Espera uma seção, não só o ytd-guide-renderer, porque ele existe vazio
  // antes de o YouTube preencher o menu.
  whenPresent(SELECTORS.guideSection, (section) => keepSidebarEntry(section.closest(SELECTORS.guide) ?? section.parentElement, openCategories));
}

async function setup() {
  setupMenus();
  await runIfAlive(syncFromDom, stopBackgroundWork);
}

// O YouTube é SPA: o content script roda uma vez, mas a página muda sem
// recarregar. Estes são os eventos que o próprio site dispara a cada troca;
// fechar no início da navegação faz a página de Categorias se comportar como
// qualquer outra página do YouTube.
document.addEventListener('yt-navigate-start', closeCategoriesPage);
document.addEventListener('yt-navigate-finish', setup);
setup();
