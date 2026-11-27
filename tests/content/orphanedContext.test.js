// Regression: after reloading the extension in chrome://extensions, the open YouTube tab kept the
// old script. On the next navigation it called chrome.storage and blew up with "Uncaught (in
// promise) Error: Extension context invalidated."
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
  // Script loaded with the extension alive...
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: { get: invalidated, set: invalidated }, onChanged: { addListener: () => {} } } };
  await import('../../src/content/main.js');
  await flush();
  // ...and the extension reloaded right after: this script's context is lost.
  globalThis.chrome.runtime = {};
  rejections.length = 0;
});

afterAll(() => {
  process.off('unhandledRejection', recordRejection);
});

it('navigating in an orphaned tab raises no unhandled error', async () => {
  document.dispatchEvent(new Event('yt-navigate-finish'));
  await flush();
  expect(rejections.map(String)).toEqual([]);
});

it('clicking Categories in an orphaned tab tells the user to reload the page', async () => {
  document.querySelector(`#${ENTRY_ID} button`).click();
  await flush();
  expect(rejections.map(String)).toEqual([]);
  expect(document.getElementById(TOAST_ID)?.textContent).toContain('Recarregue a página');
});
