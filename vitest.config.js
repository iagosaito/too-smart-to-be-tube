import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom porque boa parte do código manipula o DOM do YouTube.
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
