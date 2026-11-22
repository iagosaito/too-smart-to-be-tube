import { CATEGORY_CONTROL, renderChannelGrid } from './components/channelGrid.js';
import { renderChips } from './components/chips.js';
import { renderBulkBar, renderEmptyState } from './components/feedback.js';
import { renderHeader } from './components/header.js';
import { renderImportReview } from './components/importReview.js';
import { planImport } from '../import/categorizationImport.js';
import { renderViewHeading } from './components/viewHeading.js';
import { buildChips, FILTER_ALL, FILTER_NONE, formatUploadAge, SORT_RECENT, visibleChannels } from './view.js';

// Regiões fixas da página. Cada render preenche cada região separadamente,
// assim a grade (a parte cara) não é tocada quando só o cabeçalho muda.
export const SLOTS = ['header', 'review', 'chips', 'heading', 'results', 'bulkBar'];

// env agrupa o que não é estado nem ação: o relógio (injetável nos testes) e o cache de cartões.
export function renderPage(state, view, actions, { now, cardCache }) {
  const channels = visibleChannels(state, view);
  return {
    header: renderHeader({ state, view, actions, now }),
    review: view.pendingImport ? renderPendingImport(state, view.pendingImport, actions) : null,
    chips: renderChips(buildChips(state), view.filter, actions),
    heading: renderViewHeading(state, view, actions, channels.length),
    results: channels.length
      ? renderChannelGrid(channels, {
        categories: state.categories,
        view,
        actions,
        cache: cardCache,
        metaOf: metaFor(state, view, now),
        control: categoryControlFor(view.filter),
      })
      : renderEmptyState(emptyStateFor(state, view, actions)),
    bulkBar: view.selected.size ? renderBulkBar(state.categories, view.selected.size, actions) : null,
  };
}

function categoryControlFor(filter) {
  if (filter === FILTER_ALL) return CATEGORY_CONTROL.PILL;
  if (filter === FILTER_NONE) return CATEGORY_CONTROL.CHOOSE;
  return CATEGORY_CONTROL.MOVE_ICON;
}

function metaFor(state, view, now) {
  // Em ordem de recência, dizer "sem vídeos recentes" explica por que o canal
  // está no fim; em A–Z isso seria só ruído, então a linha some.
  const fallback = view.sort === SORT_RECENT ? 'Sem vídeos recentes' : null;
  return (channel) => formatUploadAge(state.latestUploads?.[channel.id], now) ?? fallback;
}

function renderPendingImport(state, pending, actions) {
  // O resumo é recalculado a cada render: se o usuário mexer em algo enquanto
  // revisa, os números continuam batendo com o que será aplicado.
  const summary = pending.entries ? planImport(state, pending.entries).summary : null;
  return renderImportReview(pending, summary, actions);
}

function emptyStateFor(state, view, actions) {
  if (!Object.keys(state.channels).length) {
    const action = actions.canSync ? { label: 'Sincronizar inscrições', onClick: actions.sync } : null;
    return { title: 'Nenhuma inscrição ainda', text: 'Sincronize para trazer seus canais.', action };
  }
  if (view.query) {
    return { title: 'Nenhum canal encontrado', text: `Nada corresponde a "${view.query}".`, action: { label: 'Limpar busca', onClick: () => actions.search('') } };
  }
  if (view.filter === FILTER_NONE) {
    return { title: 'Tudo organizado!', text: 'Todos os seus canais já têm uma categoria.' };
  }
  return {
    title: 'Categoria vazia',
    text: 'Abra "Sem categoria", marque os canais e mova-os para cá.',
    action: { label: 'Ver canais sem categoria', onClick: () => actions.setFilter(FILTER_NONE) },
  };
}
