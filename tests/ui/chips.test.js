import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preserveChipsScroll, renderChips, updateArrows } from '../../src/ui/components/chips.js';

// O jsdom não calcula layout: simulamos as medidas de rolagem por elemento.
const layout = new WeakMap();
const measure = (node) => layout.get(node) ?? {};
const restorers = [];

function mockLayoutProperty(name, writable = false) {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name) ?? Object.getOwnPropertyDescriptor(Element.prototype, name);
  Object.defineProperty(HTMLElement.prototype, name, {
    configurable: true,
    get() { return measure(this)[name] ?? 0; },
    set: writable ? function set(value) { layout.set(this, { ...measure(this), [name]: value }); } : undefined,
  });
  restorers.push(() => (original ? Object.defineProperty(HTMLElement.prototype, name, original) : delete HTMLElement.prototype[name]));
}

beforeEach(() => {
  ['scrollWidth', 'clientWidth', 'offsetLeft', 'offsetWidth'].forEach((name) => mockLayoutProperty(name));
  mockLayoutProperty('scrollLeft', true);
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  restorers.splice(0).forEach((restore) => restore());
});

const chips = [
  { id: 'all', label: 'Todas', count: 10 },
  { id: 'a', label: 'Alfa', count: 3 },
  { id: 'b', label: 'Beta', count: 2 },
  { id: 'none', label: 'Sem categoria', count: 5 },
];
const actions = { setFilter: vi.fn(), create: vi.fn() };
const root = () => document.getElementById('root');
const mount = (activeId = 'all') => root().replaceChildren(renderChips(chips, activeId, actions));
const track = () => root().querySelector('.tstb-chips-track');
const arrow = (side) => root().querySelector(`.tstb-chips-arrow-${side}`);
const labels = (container) => [...container.querySelectorAll('.tstb-chip-label')].map((node) => node.textContent);

describe('renderChips', () => {
  it('fixa "Todas" no início e "Sem categoria" no fim, com divisores; só as categorias rolam', () => {
    mount();
    const nav = root().querySelector('nav');
    expect([...nav.children].map((node) => node.className.split(' ')[0])).toEqual([
      'tstb-chip', 'tstb-chips-divider', 'tstb-chips-scroller', 'tstb-chips-divider', 'tstb-chip',
    ]);
    expect(labels(nav.firstElementChild)).toEqual(['Todas']);
    expect(labels(track())).toEqual(['Alfa', 'Beta']);
    expect(track().lastElementChild.textContent).toContain('Nova categoria');
    expect(labels(nav.lastElementChild)).toEqual(['Sem categoria']);
  });

  it('"Todas" tem ícone e "Sem categoria" estilo de fila; o destaque de cor é só do ativo', () => {
    mount('b');
    expect(root().querySelector('.tstb-chip-all svg')).not.toBeNull();
    expect(root().querySelector('.tstb-chip-pending').textContent).toContain('Sem categoria');
    expect([...root().querySelectorAll('.tstb-chip-active')].map((node) => node.dataset.chipId)).toEqual(['b']);
  });

  it('clicar num chip filtra pela categoria', () => {
    mount();
    root().querySelector('[data-chip-id="a"]').click();
    expect(actions.setFilter).toHaveBeenCalledWith('a');
  });
});

describe('updateArrows', () => {
  function setTrack(values) {
    layout.set(track(), { ...measure(track()), ...values });
    updateArrows(track());
  }

  it('esconde as duas setas quando tudo cabe', () => {
    mount();
    setTrack({ scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
    expect([arrow('prev').hidden, arrow('next').hidden]).toEqual([true, true]);
  });

  it('mostra só a seta da direção onde há mais chips', () => {
    mount();
    setTrack({ scrollWidth: 900, clientWidth: 300, scrollLeft: 0 });
    expect([arrow('prev').hidden, arrow('next').hidden]).toEqual([true, false]);
    setTrack({ scrollLeft: 300 });
    expect([arrow('prev').hidden, arrow('next').hidden]).toEqual([false, false]);
    setTrack({ scrollLeft: 600 });
    expect([arrow('prev').hidden, arrow('next').hidden]).toEqual([false, true]);
  });

  it('a seta avança pela largura visível', () => {
    mount();
    track().scrollBy = vi.fn();
    setTrack({ scrollWidth: 900, clientWidth: 300, scrollLeft: 0 });
    arrow('next').click();
    expect(track().scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 240 }));
  });
});

describe('preserveChipsScroll', () => {
  it('mantém a posição da rolagem quando a barra é recriada', () => {
    mount('all');
    track().scrollLeft = 120;
    preserveChipsScroll(root(), () => mount('all'));
    expect(track().scrollLeft).toBe(120);
  });

  it('traz para a vista o chip que acabou de ficar ativo', () => {
    mount('all');
    preserveChipsScroll(root(), () => {
      mount('b');
      layout.set(track(), { clientWidth: 200, scrollWidth: 800 });
      layout.set(root().querySelector('[data-chip-id="b"]'), { offsetLeft: 500, offsetWidth: 80 });
    });
    // 500 + 80 - 200 + 48 de margem para o chip não ficar colado na seta.
    expect(track().scrollLeft).toBe(428);
  });
});
