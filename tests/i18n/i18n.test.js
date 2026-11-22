import { afterEach, describe, expect, it } from 'vitest';
import { describeError, LocalizedError } from '../../src/i18n/errors.js';
import { DICTIONARIES, detectLocale, localeTag, plural, relativeTime, t } from '../../src/i18n/i18n.js';

const fakeDoc = (lang) => ({ documentElement: { lang } });
const fakeNav = (language) => ({ language });

afterEach(() => {
  document.documentElement.lang = 'pt-BR';
});

describe('detectLocale', () => {
  it.each([
    ['en', 'en'],
    ['en-GB', 'en'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['es-419', 'es'],
    ['ES', 'es'],
  ])('<html lang="%s"> → %s', (lang, expected) => {
    expect(detectLocale(fakeDoc(lang), fakeNav('en-US'))).toBe(expected);
  });

  it('segue o idioma do YouTube mesmo com o navegador em outro idioma', () => {
    expect(detectLocale(fakeDoc('es-419'), fakeNav('pt-BR'))).toBe('es');
  });

  it('usa o idioma do navegador quando a página não declara lang', () => {
    expect(detectLocale(fakeDoc(''), fakeNav('pt-BR'))).toBe('pt');
  });

  it('cai no inglês para idiomas sem tradução', () => {
    expect(detectLocale(fakeDoc('fr-FR'), fakeNav('de-DE'))).toBe('en');
    // null (e não undefined): undefined ativaria os padrões, que leem a página real.
    expect(detectLocale(null, null)).toBe('en');
  });
});

describe('t', () => {
  it('traduz no idioma ativo da página e interpola parâmetros', () => {
    document.documentElement.lang = 'en';
    expect(t('heading.renameLabel', { name: 'Tech' })).toBe('Rename category Tech');
    document.documentElement.lang = 'es-419';
    expect(t('heading.renameLabel', { name: 'Tech' })).toBe('Renombrar categoría Tech');
  });

  it('usa o inglês quando a chave falta no idioma e a própria chave se nem o inglês tiver', () => {
    const original = DICTIONARIES.es['chips.new'];
    delete DICTIONARIES.es['chips.new'];
    try {
      expect(t('chips.new', {}, 'es')).toBe('New category');
    } finally {
      DICTIONARIES.es['chips.new'] = original;
    }
    expect(t('chave.inexistente', {}, 'pt')).toBe('chave.inexistente');
  });

  it('mantém placeholders sem valor em vez de escrever "undefined"', () => {
    expect(t('heading.renameLabel', {}, 'en')).toBe('Rename category {name}');
  });
});

describe('plural', () => {
  it.each([
    ['en', 1, '1 channel'],
    ['en', 2, '2 channels'],
    ['pt', 1, '1 canal'],
    ['pt', 3, '3 canais'],
    ['es', 1, '1 canal'],
    ['es', 5, '5 canales'],
  ])('%s %i → %s', (locale, count, expected) => {
    expect(plural('heading.channels', count, {}, locale)).toBe(expected);
  });

  it('zero vai para o plural em todos os idiomas (inclusive pt-BR, que o Unicode trata como singular)', () => {
    expect(plural('heading.channels', 0, {}, 'pt')).toBe('0 canais');
    expect(plural('heading.channels', 0, {}, 'en')).toBe('0 channels');
    expect(plural('heading.channels', 0, {}, 'es')).toBe('0 canales');
  });
});

describe('relativeTime', () => {
  const MIN = 60_000;
  const DAY = 24 * 60 * MIN;
  it.each([
    ['en', 5 * MIN, '5 minutes ago'],
    ['pt', 5 * MIN, 'há 5 minutos'],
    ['es', 5 * MIN, 'hace 5 minutos'],
    ['en', DAY, 'yesterday'],
    ['pt', DAY, 'ontem'],
    ['es', DAY, 'ayer'],
    ['pt', 2 * DAY, 'há 2 dias'],
    ['es', 2 * DAY, 'hace 2 días'],
    ['en', 14 * DAY, '2 weeks ago'],
    ['pt', 60 * DAY, 'há 2 meses'],
    ['es', 800 * DAY, 'hace 2 años'],
  ])('%s %i ms → %s', (locale, elapsed, expected) => {
    expect(relativeTime(elapsed, locale)).toBe(expected);
  });
});

describe('localeTag', () => {
  it('converte o idioma curto na tag completa para as APIs Intl', () => {
    expect([localeTag('en'), localeTag('pt'), localeTag('es')]).toEqual(['en', 'pt-BR', 'es']);
  });
});

// Impede publicar um idioma com tradução faltando: toda chave precisa
// existir em todos os idiomas, com o mesmo tipo (texto ou plural).
describe('paridade dos dicionários', () => {
  const shape = (dictionary) =>
    Object.fromEntries(Object.entries(dictionary).map(([key, value]) => [key, typeof value === 'string' ? 'text' : Object.keys(value).sort().join('/')]));

  it.each(['pt', 'es'])('%s tem exatamente as mesmas chaves que o inglês', (locale) => {
    expect(shape(DICTIONARIES[locale])).toEqual(shape(DICTIONARIES.en));
  });

  it.each(['en', 'pt', 'es'])('%s não tem textos vazios', (locale) => {
    const texts = Object.values(DICTIONARIES[locale]).flatMap((value) => (typeof value === 'string' ? [value] : Object.values(value)));
    expect(texts.filter((text) => !text.trim())).toEqual([]);
  });
});

describe('describeError', () => {
  it('traduz erros localizados no idioma ativo e mantém a mensagem dos demais', () => {
    document.documentElement.lang = 'en';
    expect(describeError(new LocalizedError('error.http', { status: 401 }))).toBe('YouTube responded 401');
    expect(describeError(new Error('falha qualquer'))).toBe('falha qualquer');
  });
});
