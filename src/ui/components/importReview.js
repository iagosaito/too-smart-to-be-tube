import { el } from '../elements.js';
import { plural, t } from '../../i18n/i18n.js';

// How many names of skipped rows to list: enough to recognize the problem without turning the card
// into a wall of text.
const MAX_UNKNOWN_LISTED = 15;

// Review before applying: importing overwrites manual organization, so the user sees the impact and
// decides. It sits right below the header, close to the button that opened it.
export function renderImportReview(pending, summary, actions) {
  if (pending.error || summary?.error || !summary?.matched) return renderImportError(pending, summary, actions);
  return el('section', { className: 'tstb-review', role: 'region', 'aria-label': t('import.reviewTitle') }, [
    el('h3', { tabindex: '-1' }, t('import.reviewTitle')),
    el('p', { className: 'tstb-review-file' }, pending.fileName),
    el('ul', { className: 'tstb-review-stats' }, summaryLines(summary).map((line) => el('li', {}, line))),
    summary.unknown.length ? renderUnknown(summary.unknown) : null,
    el('p', { className: 'tstb-hint' }, t('import.keepNote')),
    renderButtons(actions, t('import.apply')),
  ]);
}

function summaryLines({ matched, categoryCount, created, moved }) {
  return [
    t('import.summary', { channels: plural('import.willOrganize', matched), categories: plural('import.categories', categoryCount) }),
    created.length ? plural('import.newCategories', created.length, { names: created.join(', ') }) : null,
    plural('import.moved', moved),
  ].filter(Boolean);
}

function renderUnknown(unknown) {
  // <details> keeps the card short; only those who want to investigate open the list.
  const listed = unknown.slice(0, MAX_UNKNOWN_LISTED);
  const rest = unknown.length - listed.length;
  return el('details', { className: 'tstb-review-unknown' }, [
    el('summary', {}, plural('import.ignored', unknown.length)),
    el('ul', {}, [...listed.map((name) => el('li', {}, name)), rest ? el('li', {}, t('import.andMore', { count: rest })) : null]),
  ]);
}

function renderImportError(pending, summary, actions) {
  // pending.error holds the translation key, translated only at display time.
  const message = t(pending.error ?? summary?.error ?? 'import.noMatch');
  return el('section', { className: 'tstb-review tstb-review-error', role: 'alert' }, [
    el('h3', { tabindex: '-1' }, t('import.errorTitle')),
    el('p', { className: 'tstb-review-file' }, pending.fileName),
    el('p', {}, message),
    summary?.unknown.length ? renderUnknown(summary.unknown) : null,
    renderButtons(actions, null),
  ]);
}

function renderButtons(actions, applyLabel) {
  // The main action sits on the right, emphasized; without it, the only button is "Close".
  return el('div', { className: 'tstb-review-actions' }, [
    el('button', { type: 'button', className: 'tstb-button', onClick: actions.cancelImport }, applyLabel ? t('common.cancel') : t('common.close')),
    applyLabel ? el('button', { type: 'button', className: 'tstb-button tstb-button-primary', onClick: actions.applyImport }, applyLabel) : null,
  ]);
}
