import en from './locales/en.js';
import es from './locales/es.js';
import pt from './locales/pt.js';

// A interface segue o idioma em que o YouTube está, e não o do navegador:
// quem usa o YouTube em inglês espera a extensão em inglês. Por isso não
// usamos chrome.i18n (que segue o idioma do Chrome) para a interface.

export const DICTIONARIES = { en, pt, es };
export const DEFAULT_LOCALE = 'en';
// Tag completa para as APIs Intl (datas relativas, plural, ordenação).
const LOCALE_TAGS = { en: 'en', pt: 'pt-BR', es: 'es' };

export function detectLocale(doc = globalThis.document, nav = globalThis.navigator) {
  // O YouTube define <html lang> com o idioma escolhido pelo usuário
  // (ex.: "pt-BR", "es-419"); o navegador é só a reserva.
  const candidates = [doc?.documentElement?.lang, nav?.language];
  for (const candidate of candidates) {
    const base = String(candidate ?? '').toLowerCase().split('-')[0];
    if (base && DICTIONARIES[base]) return base;
  }
  // Idiomas sem tradução caem no inglês, o mais compreendido.
  return DEFAULT_LOCALE;
}

export function localeTag(locale = detectLocale()) {
  return LOCALE_TAGS[locale];
}

// Detecta a cada chamada (ler um atributo é barato): se o usuário trocar o
// idioma do YouTube, a próxima renderização já sai no idioma novo.
export function t(key, params = {}, locale = detectLocale()) {
  const template = lookup(key, locale);
  return typeof template === 'string' ? interpolate(template, params) : key;
}

export function plural(key, count, params = {}, locale = detectLocale()) {
  const forms = lookup(key, locale);
  if (typeof forms !== 'object' || forms === null) return key;
  // Pelas regras do Unicode o português do Brasil trata 0 como singular
  // ("0 canal"); no uso real "0 canais" é o natural, então zero vai sempre
  // para o plural.
  const form = count === 0 ? 'other' : new Intl.PluralRules(localeTag(locale)).select(count);
  return interpolate(forms[form] ?? forms.other, { count, ...params });
}

export function relativeTime(elapsedMs, locale = detectLocale()) {
  const { value, unit } = largestUnit(elapsedMs);
  // "auto" só para exatamente 1 dia: dá "ontem"/"yesterday"/"ayer", natural
  // nos três idiomas. Em outros casos o "auto" gera formas que só existem em
  // alguns idiomas ("anteontem") ou soam estranhas ("semana passada").
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
  // Chave sem tradução no idioma ativo usa o inglês: melhor um texto em
  // inglês do que a chave crua na tela (o teste de paridade evita isso).
  return DICTIONARIES[locale]?.[key] ?? DICTIONARIES[DEFAULT_LOCALE][key];
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
