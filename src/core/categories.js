import { sortByName } from './channels.js';

const defaultMakeId = () => crypto.randomUUID();

// Todas as funções devolvem um novo array em vez de mutar: o estado vem do
// storage e é re-renderizado, então mutações escondidas causariam bugs sutis.

export function createCategory(categories, name, makeId = defaultMakeId) {
  const cleanName = name?.trim();
  if (!cleanName || hasCategoryNamed(categories, cleanName)) return categories;
  return [...categories, { id: makeId(), name: cleanName, channelIds: [] }];
}

export function renameCategory(categories, categoryId, name) {
  const cleanName = name?.trim();
  if (!cleanName || hasCategoryNamed(categories, cleanName, categoryId)) return categories;
  return categories.map((category) =>
    category.id === categoryId ? { ...category, name: cleanName } : category,
  );
}

export function removeCategory(categories, categoryId) {
  // Os canais da categoria removida voltam naturalmente para "Sem categoria".
  return categories.filter((category) => category.id !== categoryId);
}

// Um canal pertence a no máximo uma categoria: mantém a UI simples (um único
// seletor por canal) e evita o canal aparecer repetido no painel.
export function assignChannel(categories, channelId, categoryId) {
  return categories.map((category) => {
    const withoutChannel = category.channelIds.filter((id) => id !== channelId);
    const channelIds = category.id === categoryId ? [...withoutChannel, channelId] : withoutChannel;
    return { ...category, channelIds };
  });
}

// Reaproveita assignChannel para que mover em lote siga exatamente a mesma
// regra de "uma categoria por canal" que mover individualmente.
export function assignChannels(categories, channelIds, categoryId) {
  return channelIds.reduce((result, channelId) => assignChannel(result, channelId, categoryId), categories);
}

// Ordem de exibição é sempre alfabética, independente da ordem de criação:
// posições previsíveis deixam achar a categoria sem ler a lista inteira, e
// não mudam quando canais são movidos (como aconteceria ordenando por tamanho).
export function sortCategoriesByName(categories, locale) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
}

export function findCategoryOf(categories, channelId) {
  return categories.find((category) => category.channelIds.includes(channelId)) ?? null;
}

export function groupChannels(categories, channelsById, locale) {
  const assigned = new Set();
  const groups = categories.map((category) => {
    // Ignora ids sem canal conhecido (ex.: inscrição cancelada) em vez de quebrar.
    const channels = category.channelIds.map((id) => channelsById[id]).filter(Boolean);
    channels.forEach((channel) => assigned.add(channel.id));
    return { category, channels: sortByName(channels, locale) };
  });
  const uncategorized = Object.values(channelsById).filter((channel) => !assigned.has(channel.id));
  return { groups, uncategorized: sortByName(uncategorized, locale) };
}

function hasCategoryNamed(categories, name, ignoreId = null) {
  // Comparação sem diferenciar maiúsculas: "Música" e "música" confundiriam o usuário.
  const target = name.toLocaleLowerCase();
  return categories.some(
    (category) => category.id !== ignoreId && category.name.toLocaleLowerCase() === target,
  );
}
