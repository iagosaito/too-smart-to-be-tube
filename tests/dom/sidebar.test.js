import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTRY_ID, injectMiniGuideEntry, injectSidebarEntry, keepMiniGuideEntry, keepSidebarEntry, MINI_ENTRY_ID } from '../../src/dom/sidebar.js';
import { GUIDE_HTML } from '../helpers/youtubeFixtures.js';

const guide = () => document.querySelector('ytd-guide-renderer');

beforeEach(() => {
  document.body.innerHTML = GUIDE_HTML;
});

describe('injectSidebarEntry', () => {
  it("inserts the item right after the menu's first section", () => {
    const entry = injectSidebarEntry(guide(), () => {});
    expect(document.querySelector('#main').nextElementSibling).toBe(entry);
    expect(entry.textContent).toContain('Categorias');
  });

  it('is idempotent across navigations', () => {
    const first = injectSidebarEntry(guide(), () => {});
    const second = injectSidebarEntry(guide(), () => {});
    expect(second).toBe(first);
    expect(document.querySelectorAll(`#${ENTRY_ID}`)).toHaveLength(1);
  });

  it('calls the callback on click', () => {
    const onClick = vi.fn();
    injectSidebarEntry(guide(), onClick).querySelector('button').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('returns null when the menu has no sections yet', () => {
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

  it('inserts between Shorts and Subscriptions, inside the native list', () => {
    injectMiniGuideEntry(items(), () => {});
    expect(labels()).toEqual(['Início', 'Shorts', 'Categorias', 'Inscrições', 'Você']);
  });

  it('works when the items are nested in an extra layer', () => {
    document.body.innerHTML = `<ytd-mini-guide-renderer><div id="items"><div class="wrapper">
      ${miniEntry('/shorts', 'Shorts')}${miniEntry('/feed/subscriptions', 'Inscrições')}
    </div></div></ytd-mini-guide-renderer>`;
    expect(() => injectMiniGuideEntry(items(), () => {})).not.toThrow();
    const wrapper = items().querySelector('.wrapper');
    expect([...wrapper.children].map((node) => node.textContent.trim())).toEqual(['Shorts', 'Categorias', 'Inscrições']);
  });

  it('keepMiniGuideEntry reinserts the item when YouTube redraws the list', async () => {
    const observer = keepMiniGuideEntry(items(), () => {});
    // Simulates YouTube recreating the list with its own items.
    items().replaceChildren(...new DOMParser().parseFromString(
      `<div>${miniEntry('/shorts', 'Shorts')}${miniEntry('/feed/subscriptions', 'Inscrições')}</div>`, 'text/html',
    ).body.firstChild.children);
    await Promise.resolve();
    expect(labels()).toEqual(['Shorts', 'Categorias', 'Inscrições']);
    observer.disconnect();
  });

  it('without Subscriptions, goes right after Shorts', () => {
    items().querySelector('a[href="/feed/subscriptions"]').closest('ytd-mini-guide-entry-renderer').remove();
    injectMiniGuideEntry(items(), () => {});
    expect(labels()).toEqual(['Início', 'Shorts', 'Categorias', 'Você']);
  });

  it('without Shorts or Subscriptions, goes to the end of the list', () => {
    document.body.innerHTML = `<ytd-mini-guide-renderer><div id="items">${miniEntry('/', 'Início')}</div></ytd-mini-guide-renderer>`;
    injectMiniGuideEntry(items(), () => {});
    expect(labels()).toEqual(['Início', 'Categorias']);
  });

  it('is idempotent and calls the callback on click', () => {
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

  it("reinserts the item when YouTube redraws the expanded menu's sections", async () => {
    const observer = keepSidebarEntry(guide(), () => {});
    const sections = guide().querySelector('#sections');
    // Simulates YouTube recreating the sections when expanding the menu: our item disappears.
    const fresh = [...sections.querySelectorAll('ytd-guide-section-renderer')].map((node) => node.cloneNode(true));
    sections.replaceChildren(...fresh);
    expect(document.getElementById(ENTRY_ID)).toBeNull();
    await Promise.resolve();
    expect(document.querySelector('#main').nextElementSibling.id).toBe(ENTRY_ID);
    observer.disconnect();
  });

  it("doesn't stack observers when called again on the same menu", () => {
    const first = keepSidebarEntry(guide(), () => {});
    expect(keepSidebarEntry(guide(), () => {})).toBeNull();
    expect(document.querySelectorAll(`#${ENTRY_ID}`)).toHaveLength(1);
    first.disconnect();
  });
});
