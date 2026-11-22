import { scrapeChannels } from '../dom/scraper.js';
import { SELECTORS } from '../dom/selectors.js';
import { injectSidebarEntry, keepMiniGuideEntry } from '../dom/sidebar.js';
import { waitFor } from '../dom/waitFor.js';
import { createStore } from '../storage/store.js';
import { closeCategoriesPage, openCategoriesPage } from '../ui/page.js';
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
    console.warn('[Too Smart To Be Tube] Não foi possível ler o feed de inscrições:', error);
  }
}

async function openCategories() {
  // A leitura do DOM é instantânea e já mostra algo enquanto a sincronização
  // completa (várias requisições) roda em segundo plano.
  await syncFromDom();
  await openCategoriesPage({ store, sync: syncAllSubscriptions });
}

let miniGuideStarted = false;

async function setupMiniGuide() {
  // O menu recolhido só é montado quando o usuário o recolhe (ou a janela
  // estreita), o que pode acontecer muito depois do carregamento: por isso a
  // espera não tem timeout. Roda uma vez só: depois disso o observer de
  // keepMiniGuideEntry cuida de manter o item no lugar.
  if (miniGuideStarted) return;
  miniGuideStarted = true;
  const items = await waitFor(SELECTORS.miniGuideItems, { timeout: null });
  keepMiniGuideEntry(items, openCategories);
}

async function setup() {
  setupMiniGuide();
  // Espera uma seção, não só o ytd-guide-renderer, porque ele existe vazio
  // antes de o YouTube preencher o menu.
  const section = await waitFor(SELECTORS.guideSection).catch(() => null);
  if (!section) return;
  injectSidebarEntry(section.closest(SELECTORS.guide) ?? document, openCategories);
  await syncFromDom();
}

// O YouTube é SPA: o content script roda uma vez, mas a página muda sem
// recarregar. Estes são os eventos que o próprio site dispara a cada troca;
// fechar no início da navegação faz a página de Categorias se comportar como
// qualquer outra página do YouTube.
document.addEventListener('yt-navigate-start', closeCategoriesPage);
document.addEventListener('yt-navigate-finish', setup);
setup();
