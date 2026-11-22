import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { plural, t } from '../../i18n/i18n.js';
import { formatSyncInfo } from '../view.js';

export function renderHeader({ state, view, actions, now }) {
  return el('header', { className: 'tstb-page-header' }, [
    el('div', { className: 'tstb-heading' }, [el('h1', {}, t('app.title')), renderSubtitle(state, view, now)]),
    el('div', { className: 'tstb-header-actions' }, [
      renderSearch(view.query, actions),
      actions.canSync ? renderSyncButton(view.syncing, actions) : null,
      renderImportButton(Object.keys(state.channels).length > 0, actions),
      renderExportButton(Object.keys(state.channels).length > 0, actions),
    ]),
  ]);
}

function renderSubtitle(state, view, now) {
  const total = plural('header.subscriptions', Object.keys(state.channels).length);
  // O erro fica no mesmo lugar do status: o usuário procura o problema onde
  // costuma ver se a sincronização deu certo.
  if (view.syncError) {
    return el('p', { className: 'tstb-subtitle tstb-error', role: 'alert' }, `${total} · ${t('header.syncFailed', { error: view.syncError })}`);
  }
  const info = view.syncing ? t('header.syncing') : formatSyncInfo(state.lastSyncedAt, now);
  return el('p', { className: 'tstb-subtitle', role: 'status' }, `${total} · ${info}`);
}

function renderSearch(query, actions) {
  const input = el('input', {
    type: 'search',
    className: 'tstb-search-input',
    placeholder: t('header.search'),
    'aria-label': t('header.search'),
    value: query,
    // Chave de foco: a página é re-renderizada a cada tecla e o foco precisa voltar aqui.
    'data-focus-key': 'search',
    onInput: (event) => actions.searchAsYouType(event.target.value),
  });
  return el('label', { className: 'tstb-search' }, [svgIcon(ICONS.search), input]);
}

function renderSyncButton(syncing, actions) {
  return el(
    'button',
    { type: 'button', className: syncing ? 'tstb-button tstb-syncing' : 'tstb-button', disabled: syncing, onClick: actions.sync },
    [svgIcon(ICONS.sync), syncing ? t('header.syncing') : t('header.sync')],
  );
}

// Fica no cabeçalho, ao lado de Sincronizar, porque age sobre a coleção
// inteira (não sobre o filtro ou a seleção atual). O rótulo diz o formato
// antes do clique; desabilitado sem inscrições para não baixar arquivo vazio.
function renderExportButton(hasChannels, actions) {
  return el(
    'button',
    { type: 'button', className: 'tstb-button', disabled: !hasChannels, onClick: actions.exportCsv },
    [svgIcon(ICONS.download), t('header.export')],
  );
}

// Par de Exportar: o mesmo formato vai e volta. Desabilitado sem inscrições
// porque a importação só organiza canais que já estão na lista.
function renderImportButton(hasChannels, actions) {
  return el(
    'button',
    { type: 'button', className: 'tstb-button', disabled: !hasChannels, onClick: actions.importCsv },
    [svgIcon(ICONS.upload), t('header.import')],
  );
}
