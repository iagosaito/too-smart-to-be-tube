import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTRY_ID, injectMiniGuideEntry, injectSidebarEntry, keepMiniGuideEntry, keepSidebarEntry, MINI_ENTRY_ID } from '../../src/dom/sidebar.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const guide = () => document.querySelector('ytd-guide-renderer');

beforeEach(() => {
  document.body.innerHTML = GUIDE_HTML;
});

describe('injectSidebarEntry', () => {
  it('insere o item logo após a primeira seção do menu', () => {
    const entry = injectSidebarEntry(guide(), () => {});
    expect(document.querySelector('#main').nextElementSibling).toBe(entry);
    expect(entry.textContent).toContain('Categorias');
  });

  it('é idempotente entre navegações', () => {
    const first = injectSidebarEntry(guide(), () => {});
    const second = injectSidebarEntry(guide(), () => {});
    expect(second).toBe(first);
    expect(document.querySelectorAll(`#${ENTRY_ID}`)).toHaveLength(1);
  });

  it('chama o callback ao clicar', () => {
    const onClick = vi.fn();
    injectSidebarEntry(guide(), onClick).querySelector('button').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('retorna null quando o menu ainda não tem seções', () => {
    document.body.innerHTML = '<ytd-guide-renderer></ytd-guide-renderer>';
    expect(injectSidebarEntry(guide(), () => {})).toBeNull();
  });
});

describe('injectMiniGuideEntry', () => {
  const miniEntry = (href, label) => `<ytd-mini-guide-entry-renderer><a id="endpoint" href="${href}">${label}</a></ytd-mini-guide-entry-renderer>`;
  const MINI_GUIDE = `<ytd-mini-guide-renderer><div id="items">
    ${miniEntry('/', 'Início')}${miniEntry('/shorts/abc', 'Shorts')}${miniEntry('/feed/subscriptions', 'Inscrições')}${miniEntry('/feed/you', 'Você')}
  </div></ytd-mini-guide-renderer>`;
  const labels = () => [...items().children].map((node) => node.textContent.trim());
  const items = () => document.querySelector('ytd-mini-guide-renderer #items');

  beforeEach(() => {
    document.body.innerHTML = MINI_GUIDE;
  });

  it('insere entre Shorts e Inscrições, dentro da lista nativa', () => {
    injectMiniGuideEntry(items(), () => {});
    expect(labels()).toEqual(['Início', 'Shorts', 'Categorias', 'Inscrições', 'Você']);
  });

  it('funciona quando os itens estão aninhados numa camada extra', () => {
    document.body.innerHTML = `<ytd-mini-guide-renderer><div id="items"><div class="wrapper">
      ${miniEntry('/shorts', 'Shorts')}${miniEntry('/feed/subscriptions', 'Inscrições')}
    </div></div></ytd-mini-guide-renderer>`;
    expect(() => injectMiniGuideEntry(items(), () => {})).not.toThrow();
    const wrapper = items().querySelector('.wrapper');
    expect([...wrapper.children].map((node) => node.textContent.trim())).toEqual(['Shorts', 'Categorias', 'Inscrições']);
  });

  it('keepMiniGuideEntry reinsere o item quando o YouTube redesenha a lista', async () => {
    const observer = keepMiniGuideEntry(items(), () => {});
    // Simula o YouTube recriando a lista com seus próprios itens.
    items().replaceChildren(...new DOMParser().parseFromString(
      `<div>${miniEntry('/shorts', 'Shorts')}${miniEntry('/feed/subscriptions', 'Inscrições')}</div>`, 'text/html',
    ).body.firstChild.children);
    await Promise.resolve();
    expect(labels()).toEqual(['Shorts', 'Categorias', 'Inscrições']);
    observer.disconnect();
  });

  it('sem Inscrições, fica logo após o Shorts', () => {
    items().querySelector('a[href="/feed/subscriptions"]').closest('ytd-mini-guide-entry-renderer').remove();
    injectMiniGuideEntry(items(), () => {});
    expect(labels()).toEqual(['Início', 'Shorts', 'Categorias', 'Você']);
  });

  it('sem Shorts nem Inscrições, vai para o fim da lista', () => {
    document.body.innerHTML = `<ytd-mini-guide-renderer><div id="items">${miniEntry('/', 'Início')}</div></ytd-mini-guide-renderer>`;
    injectMiniGuideEntry(items(), () => {});
    expect(labels()).toEqual(['Início', 'Categorias']);
  });

  it('é idempotente e chama o callback ao clicar', () => {
    const onClick = vi.fn();
    const first = injectMiniGuideEntry(items(), onClick);
    expect(injectMiniGuideEntry(items(), onClick)).toBe(first);
    expect(document.querySelectorAll(`#${MINI_ENTRY_ID}`)).toHaveLength(1);
    first.querySelector('button').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

});

describe('keepSidebarEntry', () => {
  beforeEach(() => {
    document.body.innerHTML = GUIDE_HTML;
  });

  it('reinsere o item quando o YouTube redesenha as seções do menu expandido', async () => {
    const observer = keepSidebarEntry(guide(), () => {});
    const sections = guide().querySelector('#sections');
    // Simula o YouTube recriando as seções ao expandir o menu: nosso item some.
    const fresh = [...sections.querySelectorAll('ytd-guide-section-renderer')].map((node) => node.cloneNode(true));
    sections.replaceChildren(...fresh);
    expect(document.getElementById(ENTRY_ID)).toBeNull();
    await Promise.resolve();
    expect(document.querySelector('#main').nextElementSibling.id).toBe(ENTRY_ID);
    observer.disconnect();
  });

  it('não empilha observers ao ser chamado de novo no mesmo menu', () => {
    const first = keepSidebarEntry(guide(), () => {});
    expect(keepSidebarEntry(guide(), () => {})).toBeNull();
    expect(document.querySelectorAll(`#${ENTRY_ID}`)).toHaveLength(1);
    first.disconnect();
  });
});
