// Regression: with the menu collapsed, opening a category and then expanding the menu made the
// "Categories" item disappear from the expanded menu. YouTube redraws the sections when expanding
// and removes nodes that aren't its own; nothing reinserted the item until the next navigation (and
// opening Categories isn't a navigation).
import { expect, it } from 'vitest';
import { ENTRY_ID } from '../../src/dom/sidebar.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function simulateYouTubeRerenderingSections() {
  const sections = document.querySelector('#sections');
  const fresh = [...sections.querySelectorAll(':scope > ytd-guide-section-renderer')].map((node) => node.cloneNode(true));
  sections.replaceChildren(...fresh);
}

it('the Categories item comes back to the expanded menu after YouTube redraws the sections', async () => {
  document.body.innerHTML = GUIDE_HTML;
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: createFakeStorageArea(), onChanged: { addListener: () => {} } } };
  await import('../../src/content/main.js');
  await flush();
  expect(document.getElementById(ENTRY_ID)).not.toBeNull();

  simulateYouTubeRerenderingSections();
  await flush();

  expect(document.getElementById(ENTRY_ID)).not.toBeNull();
});
