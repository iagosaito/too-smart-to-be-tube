import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom because much of the code manipulates YouTube's DOM.
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup/locale.js'],
  },
});
