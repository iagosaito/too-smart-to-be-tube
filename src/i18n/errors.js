import { t } from './i18n.js';

// Errors that reach the screen (e.g. a sync failure) carry the translation key instead of fixed
// text: the throwing module doesn't need to know the language, and the UI translates at display
// time.
export class LocalizedError extends Error {
  constructor(key, params = {}) {
    super(key);
    this.name = 'LocalizedError';
    this.key = key;
    this.params = params;
  }
}

export function describeError(error) {
  return error instanceof LocalizedError ? t(error.key, error.params) : String(error?.message ?? error);
}
