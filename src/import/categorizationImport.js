import { assignChannel, createCategory, findCategoryOf } from '../core/categories.js';
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

export function planImport(state, entries) {
  const byName = new Map(Object.values(state.channels).map((channel) => [normalizeText(channel.name), channel.id]));
  const plan = { categories: state.categories, matched: new Set(), moved: new Set(), created: [], unknown: [] };
  for (const entry of entries) applyEntry(plan, entry, state, byName);
  const summary = {
    matched: plan.matched.size,
    moved: plan.moved.size,
    created: plan.created,
    unknown: plan.unknown,
    categoryCount: countUsed(plan.categories, plan.matched),
  };
  return { categories: plan.categories, summary };
}

function applyEntry(plan, entry, state, byName) {
  const channelId = resolveChannelId(entry, state.channels, byName);
  if (!channelId) {
    plan.unknown.push(entry.name || entry.id || entry.url);
    return;
  }
  const targetId = entry.category ? ensureCategory(plan, entry.category) : null;
  // Compara com o estado original: "muda de categoria" é em relação ao que o usuário tem hoje.
  if ((findCategoryOf(state.categories, channelId)?.id ?? null) !== targetId) plan.moved.add(channelId);
  else plan.moved.delete(channelId);
  plan.matched.add(channelId);
  plan.categories = assignChannel(plan.categories, channelId, targetId);
}

function resolveChannelId(entry, channels, byName) {
  // Ordem do mais confiável ao menos: o nome do canal pode mudar ou repetir.
  const candidates = [channelIdFromHref(entry.id), channelIdFromHref(entry.url), byName.get(normalizeText(entry.name))];
  return candidates.find((id) => id && channels[id]) ?? null;
}

function ensureCategory(plan, name) {
  // Reaproveita categoria existente com o mesmo nome (ignorando acentos/maiúsculas).
  const existing = plan.categories.find((category) => normalizeText(category.name) === normalizeText(name));
  if (existing) return existing.id;
  plan.categories = createCategory(plan.categories, name);
  plan.created.push(plan.categories.at(-1).name);
  return plan.categories.at(-1).id;
}

function countUsed(categories, matched) {
  return categories.filter((category) => category.channelIds.some((id) => matched.has(id))).length;
}
