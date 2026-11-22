import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Content script: APIs do navegador + a API de extensões do Chrome.
      globals: { ...globals.browser, chrome: 'readonly' },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Testes rodam no Node com jsdom: precisam dos dois conjuntos.
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Site de apresentação: script clássico (sem import) rodando no navegador.
    files: ['site/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: globals.browser },
  },
  {
    files: ['*.js', '*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
  {
    rules: {
      // "smart" permite `== null`, usado de propósito para cobrir null e undefined.
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
