import { el, svgIcon } from '../elements.js';
import { ICONS } from '../icons.js';
import { plural, t } from '../../i18n/i18n.js';
import { formatSyncInfo } from '../view.js';

export function renderHeader({ state, view, actions, now }) {
  return el('header', { className: 'tstb-page-header' }, [
    el('div', { className: 'tstb-heading' }, [el('h1', {}, t('app.title')), renderSubtitle(state, view, now)]),
    el('div', { className: 'tstb-header-actions' }, [
      renderSearch(view.query, actions),
      actions.canSync ? renderSyncButton(view, actions) : null,
      renderImportButton(Object.keys(state.channels).length > 0, actions),
      renderExportButton(Object.keys(state.channels).length > 0, actions),
    ]),
  ]);
}

function renderSubtitle(state, view, now) {
  const total = plural('header.subscriptions', Object.keys(state.channels).length);
  // The error sits where the status is: the user looks for the problem where they usually check
  // whether the sync worked.
  if (view.syncError) {
    return el('p', { className: 'tstb-subtitle tstb-error', role: 'alert' }, `${total} · ${t('header.syncFailed', { error: view.syncError })}`);
  }
  const info = view.syncing ? t('header.syncing') : formatSyncInfo(lastFetchedAt(state), now);
  return el('p', { className: 'tstb-subtitle', role: 'status' }, `${total} · ${info}`);
}

function renderSearch(query, actions) {
  const input = el('input', {
    type: 'search',
    className: 'tstb-search-input',
    placeholder: t('header.search'),
    'aria-label': t('header.search'),
    value: query,
    // Focus key: the page is re-rendered on every keystroke and focus must come back here.
    'data-focus-key': 'search',
    onInput: (event) => actions.searchAsYouType(event.target.value),
  });
  return el('label', { className: 'tstb-search' }, [svgIcon(ICONS.search), input]);
}

function renderSyncButton({ syncing, syncCoolingDown }, actions) {
  // Right after a sync, the button rests for a while (see syncCoordinator): the hint explains why
  // it's disabled instead of looking broken.
  return el(
    'button',
    {
      type: 'button',
      className: syncing ? 'tstb-button tstb-syncing' : 'tstb-button',
      disabled: syncing || syncCoolingDown,
      title: syncCoolingDown && !syncing ? t('header.syncCooldown') : null,
      onClick: actions.sync,
    },
    [svgIcon(ICONS.sync), syncing ? t('header.syncing') : t('header.sync')],
  );
}

// Lives in the header, next to Sync, because it acts on the whole collection (not on the current
// filter or selection). The label states the format before the click; disabled without
// subscriptions so it doesn't download an empty file.
function renderExportButton(hasChannels, actions) {
  return el(
    'button',
    { type: 'button', className: 'tstb-button', disabled: !hasChannels, onClick: actions.exportCsv },
    [svgIcon(ICONS.download), t('header.export')],
  );
}

// Export's counterpart: the same format goes out and comes back. Disabled without subscriptions
// because the import only organizes channels already in the list.
function renderImportButton(hasChannels, actions) {
  return el(
    'button',
    { type: 'button', className: 'tstb-button', disabled: !hasChannels, onClick: actions.importCsv },
    [svgIcon(ICONS.upload), t('header.import')],
  );
}

// The feed refresh is what brings new videos, so it counts as a sync for the user.
function lastFetchedAt({ lastSyncedAt, feedSyncedAt }) {
  if (lastSyncedAt == null) return feedSyncedAt ?? null;
  return Math.max(lastSyncedAt, feedSyncedAt ?? 0);
}
