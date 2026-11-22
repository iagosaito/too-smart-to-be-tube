import { groupChannels } from '../core/categories.js';
import { toCsv } from './csv.js';

const HEADER = ['Canal', 'Categoria', 'URL', 'Identificador'];
const NO_CATEGORY = 'Sem categoria';

// Mesma ordem da página (categorias do usuário, "Sem categoria" por último,
// nomes em ordem alfabética), para o arquivo bater com o que a pessoa vê.
export function subscriptionRows(state) {
  const { groups, uncategorized } = groupChannels(state.categories, state.channels);
  const rowsOf = (channels, categoryName) =>
    channels.map((channel) => [channel.name, categoryName, channel.url, channel.id]);
  return [
    HEADER,
    ...groups.flatMap(({ category, channels }) => rowsOf(channels, category.name)),
    ...rowsOf(uncategorized, NO_CATEGORY),
  ];
}

export function subscriptionsCsv(state) {
  return toCsv(subscriptionRows(state));
}

export function csvFileName(timestamp) {
  // Data local (não UTC): exportar às 23h não deve gerar o arquivo com a data de amanhã.
  const date = new Date(timestamp);
  const pad = (number) => String(number).padStart(2, '0');
  return `inscricoes-youtube-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
