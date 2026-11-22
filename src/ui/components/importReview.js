import { el } from '../elements.js';
import { pluralize } from '../view.js';

// Quantos nomes de linhas ignoradas listar: o suficiente para reconhecer o
// problema sem transformar o cartão numa parede de texto.
const MAX_UNKNOWN_LISTED = 15;

// Revisão antes de aplicar: importar sobrescreve organização manual, então o
// usuário vê o impacto e decide. Fica logo abaixo do cabeçalho, perto do botão que o abriu.
export function renderImportReview(pending, summary, actions) {
  if (pending.error || !summary?.matched) return renderImportError(pending, summary, actions);
  return el('section', { className: 'tstb-review', role: 'region', 'aria-label': 'Revisar importação' }, [
    el('h3', { tabindex: '-1' }, 'Revisar importação'),
    el('p', { className: 'tstb-review-file' }, pending.fileName),
    el('ul', { className: 'tstb-review-stats' }, summaryLines(summary).map((line) => el('li', {}, line))),
    summary.unknown.length ? renderUnknown(summary.unknown) : null,
    el('p', { className: 'tstb-hint' }, 'Canais que não estão no arquivo mantêm a categoria atual.'),
    renderButtons(actions, 'Aplicar importação'),
  ]);
}

function summaryLines({ matched, categoryCount, created, moved }) {
  return [
    `${pluralize(matched, 'canal será organizado', 'canais serão organizados')} em ${pluralize(categoryCount, 'categoria', 'categorias')}`,
    created.length ? `${pluralize(created.length, 'categoria nova', 'categorias novas')}: ${created.join(', ')}` : null,
    `${pluralize(moved, 'canal muda', 'canais mudam')} de categoria`,
  ].filter(Boolean);
}

function renderUnknown(unknown) {
  // <details> mantém o cartão curto; só quem quer investigar abre a lista.
  const listed = unknown.slice(0, MAX_UNKNOWN_LISTED);
  const rest = unknown.length - listed.length;
  return el('details', { className: 'tstb-review-unknown' }, [
    el('summary', {}, `${pluralize(unknown.length, 'linha ignorada', 'linhas ignoradas')}: canais que não estão nas suas inscrições`),
    el('ul', {}, [...listed.map((name) => el('li', {}, name)), rest ? el('li', {}, `e mais ${rest}`) : null]),
  ]);
}

function renderImportError(pending, summary, actions) {
  const message = pending.error ?? 'Nenhuma linha do arquivo corresponde às suas inscrições. Confira a coluna "Identificador" ou "URL".';
  return el('section', { className: 'tstb-review tstb-review-error', role: 'alert' }, [
    el('h3', { tabindex: '-1' }, 'Não foi possível importar'),
    el('p', { className: 'tstb-review-file' }, pending.fileName),
    el('p', {}, message),
    summary?.unknown.length ? renderUnknown(summary.unknown) : null,
    renderButtons(actions, null),
  ]);
}

function renderButtons(actions, applyLabel) {
  // A ação principal fica à direita e em destaque; sem ela, o único botão é "Fechar".
  return el('div', { className: 'tstb-review-actions' }, [
    el('button', { type: 'button', className: 'tstb-button', onClick: actions.cancelImport }, applyLabel ? 'Cancelar' : 'Fechar'),
    applyLabel ? el('button', { type: 'button', className: 'tstb-button tstb-button-primary', onClick: actions.applyImport }, applyLabel) : null,
  ]);
}
