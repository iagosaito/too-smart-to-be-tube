import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeCategoryMenu,
  closeCategoryMenuIfDetached,
  MENU_ID,
  openCategoryMenu,
  positionMenu,
} from '../../src/ui/components/categoryMenu.js';

const items = [
  { id: '', label: 'Sem categoria', checked: false },
  { id: 'jogos', label: 'Jogos', checked: true },
  { id: 'musica', label: 'Música', checked: false },
];

let anchor;
let onSelect;

beforeEach(() => {
  document.body.innerHTML = '<button id="gatilho">Jogos</button><div id="fora">fora</div>';
  anchor = document.getElementById('gatilho');
  onSelect = vi.fn();
});

afterEach(() => {
  closeCategoryMenu();
});

const menu = () => document.getElementById(MENU_ID);
const itemNamed = (label) => [...menu().querySelectorAll('.tstb-menu-item')].find((item) => item.textContent === label);
const open = () => openCategoryMenu(anchor, { label: 'Mover canal', items, onSelect });
const pointerdownOn = (node) => node.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const key = (name) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('openCategoryMenu', () => {
  it('opens with the options, marks the current one and focuses it', () => {
    open();
    expect(menu().getAttribute('role')).toBe('menu');
    expect([...menu().querySelectorAll('.tstb-menu-item')].map((item) => item.textContent)).toEqual(['Sem categoria', 'Jogos', 'Música']);
    expect(itemNamed('Jogos').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(itemNamed('Jogos'));
    expect(anchor.getAttribute('aria-expanded')).toBe('true');
  });

  // The reason this component exists: pressing and releasing the mouse button (without clicking an
  // option) never picks anything.
  it('pressing and releasing the mouse without clicking an option picks nothing', () => {
    open();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      itemNamed('Música').dispatchEvent(new Event(type, { bubbles: true }));
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(menu()).not.toBeNull();
  });

  it('clicking an option picks it, closes and returns the focus to the trigger', () => {
    open();
    itemNamed('Música').click();
    expect(onSelect).toHaveBeenCalledWith('musica');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(anchor);
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
  });

  it('Esc closes without picking and returns the focus', () => {
    open();
    key('Escape');
    expect(menu()).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(anchor);
  });

  it("clicking outside closes without picking; clicking the trigger doesn't close it from here", () => {
    open();
    pointerdownOn(anchor);
    expect(menu()).not.toBeNull();
    pointerdownOn(document.getElementById('fora'));
    expect(menu()).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('arrows, Home and End navigate, wrapping around', () => {
    open();
    key('ArrowDown');
    expect(document.activeElement).toBe(itemNamed('Música'));
    key('ArrowDown');
    expect(document.activeElement).toBe(itemNamed('Sem categoria'));
    key('ArrowUp');
    expect(document.activeElement).toBe(itemNamed('Música'));
    key('Home');
    expect(document.activeElement).toBe(itemNamed('Sem categoria'));
    key('End');
    expect(document.activeElement).toBe(itemNamed('Música'));
  });

  it('scrolling the page or resizing the window closes the menu', () => {
    open();
    window.dispatchEvent(new Event('scroll'));
    expect(menu()).toBeNull();
    open();
    window.dispatchEvent(new Event('resize'));
    expect(menu()).toBeNull();
  });

  it("scrolling the menu's own list doesn't close it", () => {
    open();
    menu().dispatchEvent(new Event('scroll'));
    expect(menu()).not.toBeNull();
  });

  it('opening another menu closes the previous one', () => {
    open();
    const other = document.getElementById('fora');
    openCategoryMenu(other, { label: 'Outro', items, onSelect });
    expect(document.querySelectorAll(`#${MENU_ID}`)).toHaveLength(1);
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes if the trigger disappears in a re-render', () => {
    open();
    anchor.remove();
    closeCategoryMenuIfDetached();
    expect(menu()).toBeNull();
  });
});

describe('positionMenu', () => {
  function place({ rect, height = 200, width = 220, viewport = { width: 1000, height: 800 } }) {
    const menuNode = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () => ({ ...rect, bottom: rect.top + rect.height, right: rect.left + rect.width });
    Object.defineProperty(menuNode, 'offsetHeight', { value: height });
    Object.defineProperty(menuNode, 'offsetWidth', { value: width });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(viewport.height);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(viewport.width);
    positionMenu(menuNode, trigger);
    return { top: menuNode.style.top, left: menuNode.style.left };
  }

  afterEach(() => vi.restoreAllMocks());

  it('opens right below the trigger, aligned to its left edge', () => {
    expect(place({ rect: { top: 100, left: 300, width: 32, height: 32 } })).toEqual({ top: '136px', left: '300px' });
  });

  it("opens upward when it doesn't fit below and there is more room above", () => {
    expect(place({ rect: { top: 700, left: 300, width: 32, height: 32 } })).toEqual({ top: '496px', left: '300px' });
  });

  it("doesn't go past the right edge of the screen", () => {
    expect(place({ rect: { top: 100, left: 900, width: 32, height: 32 } })).toEqual({ top: '136px', left: '772px' });
  });
});
