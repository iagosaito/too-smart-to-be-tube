// Category list inside the "Categories" item of the expanded sidebar.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

// The list's state is shared by the module (it survives the reinsertions YouTube forces); each test
// loads the module from scratch so it doesn't inherit state.
let sidebar;
beforeEach(async () => {
  vi.resetModules();
  sidebar = await import('../../src/dom/sidebar.js');
  document.body.innerHTML = GUIDE_HTML;
  document.documentElement.classList.remove('tstb-category-open');
});

const guide = () => document.querySelector('ytd-guide-renderer');
const categories = (count) => Array.from({ length: count }, (_, index) => ({ id: `c${index}`, name: `Categoria ${index}` }));
const labels = () => [...document.querySelectorAll('.tstb-sidebar-categories .tstb-sidebar-label')].map((node) => node.textContent);
const toggle = () => document.querySelector('.tstb-sidebar-toggle');

describe('categorias no menu lateral', () => {
  it('mostra as 7 primeiras e um "Mostrar mais" que expande e recolhe', () => {
    sidebar.injectSidebarEntry(guide(), () => {});
    sidebar.setSidebarCategories(categories(9), () => {});
    expect(labels()).toEqual([...categories(7).map((c) => c.name), 'Mostrar mais']);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    toggle().click();
    expect(labels()).toEqual([...categories(9).map((c) => c.name), 'Mostrar menos']);
    toggle().click();
    expect(labels()).toHaveLength(8);
  });

  it('sem passar do limite, não mostra o "Mostrar mais"', () => {
    sidebar.injectSidebarEntry(guide(), () => {});
    sidebar.setSidebarCategories(categories(3), () => {});
    expect(toggle()).toBeNull();
    expect(labels()).toHaveLength(3);
  });

  it('clicar numa categoria abre o feed dela', () => {
    const open = vi.fn();
    sidebar.injectSidebarEntry(guide(), () => {});
    sidebar.setSidebarCategories(categories(2), open);
    document.querySelectorAll('.tstb-sidebar-category')[1].click();
    expect(open).toHaveBeenCalledWith('c1');
  });

  it('destaca a categoria aberta e tira o destaque do título "Categorias"', () => {
    sidebar.injectSidebarEntry(guide(), () => {});
    sidebar.setSidebarCategories(categories(3), () => {});
    sidebar.markActiveSidebarCategory('c2');
    const active = document.querySelector('.tstb-sidebar-category-active');
    expect(active.textContent).toBe('Categoria 2');
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(document.documentElement.classList.contains('tstb-category-open')).toBe(true);

    sidebar.markActiveSidebarCategory(null);
    expect(document.querySelector('.tstb-sidebar-category-active')).toBeNull();
    expect(document.documentElement.classList.contains('tstb-category-open')).toBe(false);
  });

  it('nomes longos ficam inteiros no title (o CSS corta com reticências)', () => {
    sidebar.injectSidebarEntry(guide(), () => {});
    sidebar.setSidebarCategories([{ id: 'x', name: 'Um nome de categoria bem comprido mesmo' }], () => {});
    expect(document.querySelector('.tstb-sidebar-category').title).toBe('Um nome de categoria bem comprido mesmo');
  });

  it('a lista volta igual (inclusive expandida) quando o YouTube recria o menu', async () => {
    const observer = sidebar.keepSidebarEntry(guide(), () => {});
    sidebar.setSidebarCategories(categories(9), () => {});
    toggle().click();
    const sections = guide().querySelector('#sections');
    sections.replaceChildren(...[...sections.querySelectorAll(':scope > ytd-guide-section-renderer')].map((node) => node.cloneNode(true)));
    await Promise.resolve();
    expect(labels()).toEqual([...categories(9).map((c) => c.name), 'Mostrar menos']);
    observer.disconnect();
  });
});
