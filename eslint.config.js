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
      // Content script: browser APIs plus Chrome's extension API.
      globals: { ...globals.browser, chrome: 'readonly' },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Tests run in Node with jsdom: they need both sets.
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Landing page: classic script (no imports) running in the browser.
    files: ['site/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: globals.browser },
  },
  {
    // Build script, config files and the Claude Code hooks run in Node.
    files: ['*.js', '*.mjs', '.claude/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
  {
    rules: {
      // "smart" allows `== null`, used on purpose to cover both null and undefined.
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
