import { cleanCategoryName, createCategory } from '../core/categories.js';
import { channelIdFromHref } from '../core/channels.js';
import { normalizeText } from '../core/text.js';

// O formato do CSV é sempre em inglês (Channel, Category, URL, Identifier),
// independente do idioma da interface. Os nomes em português continuam
// aceitos porque arquivos exportados por versões anteriores usavam eles.
const COLUMNS = {
  name: ['channel', 'name', 'canal', 'nome'],
  category: ['category', 'categoria'],
  url: ['url', 'link'],
  id: ['identifier', 'id', 'handle', 'identificador'],
};
// Célula vazia já significa "sem categoria"; estes textos são aceitos por
// clareza e pela mesma compatibilidade com arquivos antigos.
const NO_CATEGORY = new Set(['No category', 'Sem categoria'].map(normalizeText));
// Limites contra arquivos malformados ou maliciosos. O tamanho limita tudo o
// que vem depois: 5 MB são ~60 mil canais e, como leitura e plano são lineares,
// o pior caso (linhas mínimas) leva ~1 s. Contar linhas seria redundante.
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
// Teto de categorias criadas de uma vez: folgado para qualquer organização
// real, mas impede que um arquivo encha o menu com lixo.
export const MAX_NEW_CATEGORIES = 1_000;

export function readImport(rows) {
  const columns = mapColumns(rows[0] ?? []);
  // error é uma chave de tradução: a interface traduz no idioma ativo.
  if (columns.category === undefined) return { entries: [], error: 'import.missingCategory' };
  if ([columns.id, columns.url, columns.name].every((index) => index === undefined)) {
    return { entries: [], error: 'import.missingIdentifier' };
  }
  const entries = rows.slice(1).map((row) => toEntry(row, columns));
  return entries.length ? { entries, error: null } : { entries, error: 'import.noRows' };
}

function mapColumns(header) {
  const normalized = header.map(normalizeText);
  const indexOf = (aliases) => {
    const index = normalized.findIndex((cell) => aliases.includes(cell));
    return index === -1 ? undefined : index;
  };
  return Object.fromEntries(Object.entries(COLUMNS).map(([key, aliases]) => [key, indexOf(aliases)]));
}

function toEntry(row, columns) {
  const cell = (key) => (columns[key] === undefined ? '' : unguard(row[columns[key]] ?? '').trim());
  const category = cell('category');
  // Vazio ou "Sem categoria" significam, explicitamente, tirar o canal de qualquer categoria.
  return { id: cell('id'), url: cell('url'), name: cell('name'), category: NO_CATEGORY.has(normalizeText(category)) ? '' : category };
}

function unguard(value) {
  // Desfaz a proteção contra fórmulas que a exportação aplica ("'=..." → "=...").
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

// O plano custa ~0,5 s com dezenas de milhares de linhas e a revisão é
// redesenhada a cada interação: reaproveita o último plano enquanto o arquivo
// e o estado forem os mesmos. O estado é recarregado (objetos novos) a cada
// gravação, então comparar por identidade basta para saber se mudou.
const planCache = new WeakMap();

export function cachedPlanImport(state, entries) {
  const cached = planCache.get(entries);
  if (cached?.channels === state.channels && cached.categories === state.categories) return cached.plan;
  const plan = planImport(state, entries);
  planCache.set(entries, { channels: state.channels, categories: state.categories, plan });
  return plan;
}

export function planImport(state, entries) {
  const { targets, unknown } = resolveTargets(state, entries);
  const created = newCategoryNames(state.categories, targets);
  const base = { matched: targets.size, created, unknown };
  // Nada é aplicado quando o arquivo passa do limite: melhor recusar inteiro
  // do que importar pela metade.
  if (created.length > MAX_NEW_CATEGORIES) {
    return { categories: state.categories, summary: { ...base, moved: 0, categoryCount: 0, error: 'import.tooManyCategories' } };
  }
  if (!targets.size) return { categories: state.categories, summary: { ...base, moved: 0, categoryCount: 0 } };
  const categories = created.reduce((list, name) => createCategory(list, name), state.categories);
  const targetIds = toCategoryIds(categories, targets);
  const summary = { ...base, moved: countMoved(state.categories, targetIds), categoryCount: new Set([...targetIds.values()].filter(Boolean)).size };
  return { categories: applyTargets(categories, targetIds), summary };
}

// Um destino por canal, valendo a última linha: linhas repetidas do mesmo
// canal não podem criar uma categoria por linha.
function resolveTargets(state, entries) {
  const byName = new Map(Object.values(state.channels).map((channel) => [normalizeText(channel.name), channel.id]));
  const targets = new Map();
  const unknown = [];
  for (const entry of entries) {
    const channelId = resolveChannelId(entry, state.channels, byName);
    if (channelId) targets.set(channelId, cleanCategoryName(entry.category));
    else unknown.push(entry.name || entry.id || entry.url);
  }
  return { targets, unknown };
}

function newCategoryNames(categories, targets) {
  // Reaproveita categoria existente com o mesmo nome (ignorando acentos/maiúsculas).
  const known = new Set(categories.map((category) => normalizeText(category.name)));
  const created = [];
  for (const name of targets.values()) {
    const key = normalizeText(name);
    if (!name || known.has(key)) continue;
    known.add(key);
    created.push(name);
  }
  return created;
}

function toCategoryIds(categories, targets) {
  // Índice por nome normalizado: buscar com find a cada linha tornava o plano quadrático.
  const idByName = new Map(categories.map((category) => [normalizeText(category.name), category.id]));
  return new Map([...targets].map(([channelId, name]) => [channelId, name ? idByName.get(normalizeText(name)) : null]));
}

function countMoved(originalCategories, targetIds) {
  // "Muda de categoria" é em relação ao que o usuário tem hoje.
  const original = new Map(originalCategories.flatMap((category) => category.channelIds.map((id) => [id, category.id])));
  return [...targetIds].filter(([channelId, categoryId]) => (original.get(channelId) ?? null) !== categoryId).length;
}

function applyTargets(categories, targetIds) {
  // Uma passada só: tira os canais importados de onde estavam e os põe no destino.
  const additions = new Map();
  for (const [channelId, categoryId] of targetIds) {
    if (!categoryId) continue;
    if (!additions.has(categoryId)) additions.set(categoryId, []);
    additions.get(categoryId).push(channelId);
  }
  return categories.map((category) => ({
    ...category,
    channelIds: [...category.channelIds.filter((id) => !targetIds.has(id)), ...(additions.get(category.id) ?? [])],
  }));
}

function resolveChannelId(entry, channels, byName) {
  // Ordem do mais confiável ao menos: o nome do canal pode mudar ou repetir.
  const candidates = [channelIdFromHref(entry.id), channelIdFromHref(entry.url), byName.get(normalizeText(entry.name))];
  return candidates.find((id) => id && channels[id]) ?? null;
}
