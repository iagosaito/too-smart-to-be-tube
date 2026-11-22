import { t } from './i18n.js';

// Erros que chegam à tela (ex.: falha de sincronização) carregam a chave de
// tradução em vez de um texto fixo: o módulo que lança não precisa saber o
// idioma, e a interface traduz na hora de mostrar.
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
