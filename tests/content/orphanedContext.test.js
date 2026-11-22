// Regressão: depois de recarregar a extensão em chrome://extensions, a aba do
// YouTube aberta continuava com o script antigo. Na navegação seguinte ele
// chamava chrome.storage e estourava "Uncaught (in promise) Error: Extension
// context invalidated."
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ENTRY_ID } from '../../src/dom/sidebar.js';
import { TOAST_ID } from '../../src/ui/components/feedback.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const invalidated = () => Promise.reject(new Error('Extension context invalidated.'));
const rejections = [];
const recordRejection = (reason) => rejections.push(reason);

beforeAll(async () => {
  process.on('unhandledRejection', recordRejection);
  document.body.innerHTML = GUIDE_HTML;
  // Script carregado com a extensão viva...
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: { get: invalidated, set: invalidated } } };
  await import('../../src/content/main.js');
  await flush();
  // ...e a extensão recarregada em seguida: o contexto deste script se perde.
  globalThis.chrome.runtime = {};
  rejections.length = 0;
});

afterAll(() => {
  process.off('unhandledRejection', recordRejection);
});

it('navegar numa aba órfã não gera erro não tratado', async () => {
  document.dispatchEvent(new Event('yt-navigate-finish'));
  await flush();
  expect(rejections.map(String)).toEqual([]);
});

it('clicar em Categorias numa aba órfã orienta a recarregar a página', async () => {
  document.querySelector(`#${ENTRY_ID} button`).click();
  await flush();
  expect(rejections.map(String)).toEqual([]);
  expect(document.getElementById(TOAST_ID)?.textContent).toContain('Recarregue a página');
});
