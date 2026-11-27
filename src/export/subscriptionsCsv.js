import { groupChannels } from '../core/categories.js';
import { toCsv } from './csv.js';

// The format is always in English, regardless of the UI language: a single format to document, edit
// in spreadsheets and import back.
const HEADER = ['Channel', 'Category', 'URL', 'Identifier'];
// An empty cell instead of translated text: it is what the import understands as "no category" in
// any language.
const NO_CATEGORY = '';

// Same order as the page (user categories, "No category" last, names alphabetical), so the file
// matches what the person sees.
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
  // Local date (not UTC): exporting at 11 p.m. must not name the file with tomorrow's date.
  const date = new Date(timestamp);
  const pad = (number) => String(number).padStart(2, '0');
  return `youtube-subscriptions-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
