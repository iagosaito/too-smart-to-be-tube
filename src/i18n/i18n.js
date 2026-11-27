import en from './locales/en.js';
import es from './locales/es.js';
import pt from './locales/pt.js';

// The UI follows the language YouTube is in, not the browser's: someone using YouTube in English
// expects the extension in English. That's why we don't use chrome.i18n (which follows Chrome's
// language) for the UI.

export const DICTIONARIES = { en, pt, es };
export const DEFAULT_LOCALE = 'en';
// Full tag for the Intl APIs (relative dates, plurals, sorting).
const LOCALE_TAGS = { en: 'en', pt: 'pt-BR', es: 'es' };

export function detectLocale(doc = globalThis.document, nav = globalThis.navigator) {
  // YouTube sets <html lang> to the language the user chose (e.g. "pt-BR", "es-419"); the browser
  // is only the fallback.
  const candidates = [doc?.documentElement?.lang, nav?.language];
  for (const candidate of candidates) {
    const base = String(candidate ?? '').toLowerCase().split('-')[0];
    if (base && DICTIONARIES[base]) return base;
  }
  // Languages without a translation fall back to English, the most widely understood.
  return DEFAULT_LOCALE;
}

export function localeTag(locale = detectLocale()) {
  return LOCALE_TAGS[locale];
}

// Detects on every call (reading an attribute is cheap): if the user switches YouTube's language,
// the next render already comes out in the new one.
export function t(key, params = {}, locale = detectLocale()) {
  const template = lookup(key, locale);
  return typeof template === 'string' ? interpolate(template, params) : key;
}

export function plural(key, count, params = {}, locale = detectLocale()) {
  const forms = lookup(key, locale);
  if (typeof forms !== 'object' || forms === null) return key;
  // By Unicode's rules Brazilian Portuguese treats 0 as singular ("0 canal"); in real usage "0
  // canais" is natural, so zero always goes to the plural.
  const form = count === 0 ? 'other' : new Intl.PluralRules(localeTag(locale)).select(count);
  return interpolate(forms[form] ?? forms.other, { count, ...params });
}

export function relativeTime(elapsedMs, locale = detectLocale()) {
  const { value, unit } = largestUnit(elapsedMs);
  // "auto" only for exactly 1 day: it gives "ontem"/"yesterday"/"ayer", natural in all three
  // languages. In other cases "auto" produces forms that only exist in some languages ("anteontem")
  // or sound odd ("last week").
  const numeric = unit === 'day' && value === 1 ? 'auto' : 'always';
  return new Intl.RelativeTimeFormat(localeTag(locale), { numeric }).format(-value, unit);
}

function largestUnit(elapsedMs) {
  const minutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 60) return { value: minutes, unit: 'minute' };
  if (hours < 24) return { value: hours, unit: 'hour' };
  if (days < 7) return { value: days, unit: 'day' };
  if (days < 30) return { value: Math.floor(days / 7), unit: 'week' };
  if (days < 365) return { value: Math.floor(days / 30), unit: 'month' };
  return { value: Math.floor(days / 365), unit: 'year' };
}

function lookup(key, locale) {
  // A key without a translation in the active language uses English: English text is better than
  // the raw key on screen (the parity test prevents this).
  return DICTIONARIES[locale]?.[key] ?? DICTIONARIES[DEFAULT_LOCALE][key];
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
