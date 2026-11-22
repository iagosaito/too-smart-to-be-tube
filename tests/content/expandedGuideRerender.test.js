// Regressão: com o menu recolhido, abrir uma categoria e depois expandir o
// menu fazia o item "Categorias" sumir do menu expandido. O YouTube redesenha
// as seções ao expandir e remove nós que não são dele; nada reinseria o item
// até a próxima navegação (e abrir Categorias não é uma navegação).
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

it('o item Categorias volta ao menu expandido depois que o YouTube redesenha as seções', async () => {
  document.body.innerHTML = GUIDE_HTML;
  globalThis.chrome = { runtime: { id: 'test' }, storage: { local: createFakeStorageArea() } };
  await import('../../src/content/main.js');
  await flush();
  expect(document.getElementById(ENTRY_ID)).not.toBeNull();

  simulateYouTubeRerenderingSections();
  await flush();

  expect(document.getElementById(ENTRY_ID)).not.toBeNull();
});
