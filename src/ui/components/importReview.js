import { el } from '../elements.js';
import { plural, t } from '../../i18n/i18n.js';

// Quantos nomes de linhas ignoradas listar: o suficiente para reconhecer o
// problema sem transformar o cartão numa parede de texto.
const MAX_UNKNOWN_LISTED = 15;

// Revisão antes de aplicar: importar sobrescreve organização manual, então o
// usuário vê o impacto e decide. Fica logo abaixo do cabeçalho, perto do botão que o abriu.
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
  // <details> mantém o cartão curto; só quem quer investigar abre a lista.
  const listed = unknown.slice(0, MAX_UNKNOWN_LISTED);
  const rest = unknown.length - listed.length;
  return el('details', { className: 'tstb-review-unknown' }, [
    el('summary', {}, plural('import.ignored', unknown.length)),
    el('ul', {}, [...listed.map((name) => el('li', {}, name)), rest ? el('li', {}, t('import.andMore', { count: rest })) : null]),
  ]);
}

function renderImportError(pending, summary, actions) {
  // pending.error guarda a chave de tradução, traduzida só na hora de mostrar.
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
  // A ação principal fica à direita e em destaque; sem ela, o único botão é "Fechar".
  return el('div', { className: 'tstb-review-actions' }, [
    el('button', { type: 'button', className: 'tstb-button', onClick: actions.cancelImport }, applyLabel ? t('common.cancel') : t('common.close')),
    applyLabel ? el('button', { type: 'button', className: 'tstb-button tstb-button-primary', onClick: actions.applyImport }, applyLabel) : null,
  ]);
}
