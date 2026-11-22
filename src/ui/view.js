import { groupChannels, sortCategoriesByName } from '../core/categories.js';
import { sortByName } from '../core/channels.js';
import { normalizeText } from '../core/text.js';

// Regras de apresentação puras (sem DOM): ficam separadas para serem testadas
// sem montar a página inteira.

export const FILTER_ALL = 'all';
export const FILTER_NONE = 'none';
export const SORT_NAME = 'name';
export const SORT_RECENT = 'recent';

// Reexportado para a UI continuar importando tudo de apresentação daqui.
export { normalizeText };

export function visibleChannels(state, view) {
  const channels = channelsForFilter(state, view.filter);
  const query = normalizeText(view.query);
  const matching = query ? channels.filter((channel) => normalizeText(channel.name).includes(query)) : channels;
  return sortChannels(matching, view.sort, state.latestUploads ?? {});
}

export function sortChannels(channels, sort, latestUploads) {
  if (sort !== SORT_RECENT) return channels;
  // Os canais já chegam em ordem alfabética e o sort é estável: empates e
  // canais sem data conhecida (que vão para o fim) continuam em ordem de nome.
  const publishedAt = (channel) => latestUploads[channel.id] ?? -Infinity;
  return [...channels].sort((a, b) => publishedAt(b) - publishedAt(a));
}

function channelsForFilter(state, filter) {
  const { groups, uncategorized } = groupChannels(state.categories, state.channels);
  if (filter === FILTER_ALL) return sortByName(Object.values(state.channels));
  if (filter === FILTER_NONE) return uncategorized;
  return groups.find((group) => group.category.id === filter)?.channels ?? [];
}

export function buildChips(state) {
  const { groups, uncategorized } = groupChannels(sortCategoriesByName(state.categories), state.channels);
  // "Sem categoria" fica no fim porque é a fila de trabalho, não um destino.
  return [
    { id: FILTER_ALL, label: 'Todas', count: Object.keys(state.channels).length },
    ...groups.map(({ category, channels }) => ({ id: category.id, label: category.name, count: channels.length })),
    { id: FILTER_NONE, label: 'Sem categoria', count: uncategorized.length },
  ];
}

export function resolveFilter(filter, categories) {
  // Uma categoria excluída deixaria a tela "presa" num filtro inexistente.
  const isFixed = filter === FILTER_ALL || filter === FILTER_NONE;
  return isFixed || categories.some((category) => category.id === filter) ? filter : FILTER_ALL;
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatSyncInfo(lastSyncedAt, now) {
  if (lastSyncedAt == null) return 'Ainda não sincronizado';
  // Tempo relativo é mais fácil de avaliar do que uma data ("isso está atualizado?").
  const minutes = Math.floor((now - lastSyncedAt) / 60_000);
  if (minutes < 1) return 'Sincronizado agora';
  if (minutes < 60) return `Sincronizado há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Sincronizado há ${hours} h`;
  return `Sincronizado há ${pluralize(Math.floor(hours / 24), 'dia', 'dias')}`;
}

export function formatUploadAge(publishedAt, now) {
  if (publishedAt == null) return null;
  // A data vem de textos como "3 days ago", então a precisão é dessa ordem:
  // mostramos a mesma granularidade que o YouTube, sem fingir exatidão.
  const hours = Math.max(0, Math.floor((now - publishedAt) / 3_600_000));
  if (hours < 24) return hours < 1 ? 'Vídeo agora há pouco' : `Vídeo há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Vídeo ontem';
  if (days < 7) return `Vídeo há ${days} dias`;
  if (days < 30) return `Vídeo há ${pluralize(Math.floor(days / 7), 'semana', 'semanas')}`;
  if (days < 365) return `Vídeo há ${pluralize(Math.floor(days / 30), 'mês', 'meses')}`;
  return `Vídeo há ${pluralize(Math.floor(days / 365), 'ano', 'anos')}`;
}

// Só o que está na tela pode estar selecionado. Sem isto, um canal marcado que
// sumia da grade (movido individualmente ou escondido pela busca) seguia
// selecionado, invisível, e era levado junto pela ação em lote.
export function pruneSelection(selected, visible) {
  const visibleIds = new Set(visible.map((channel) => channel.id));
  const kept = [...selected].filter((id) => visibleIds.has(id));
  // Mesmo Set quando nada muda: evita trabalho e re-renderizações à toa.
  return kept.length === selected.size ? selected : new Set(kept);
}
