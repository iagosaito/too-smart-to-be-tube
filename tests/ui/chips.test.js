import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderChips } from '../../src/ui/components/chips.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
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
const nav = () => root().querySelector('nav');

describe('renderChips', () => {
  it('mostra todos os chips numa única barra: Todas, categorias, Sem categoria e Nova categoria', () => {
    mount();
    const children = [...nav().children];
    expect(children.map((node) => node.querySelector('.tstb-chip-label')?.textContent ?? node.textContent.trim())).toEqual([
      'Todas', 'Alfa', 'Beta', 'Sem categoria', 'Nova categoria',
    ]);
    // No horizontal scrolling: nothing is hidden behind arrows.
    expect(nav().querySelector('.tstb-chips-track, .tstb-chips-arrow')).toBeNull();
  });

  it('"Todas" tem ícone e "Sem categoria" estilo de fila; o destaque de cor é só do ativo', () => {
    mount('b');
    expect(root().querySelector('.tstb-chip-all svg')).not.toBeNull();
    expect(root().querySelector('.tstb-chip-pending').textContent).toContain('Sem categoria');
    expect([...root().querySelectorAll('.tstb-chip-active')].map((node) => node.dataset.chipId)).toEqual(['b']);
  });

  it('mostra a contagem e filtra ao clicar', () => {
    mount();
    const alfa = root().querySelector('[data-chip-id="a"]');
    expect(alfa.querySelector('.tstb-chip-count').textContent).toBe('3');
    alfa.click();
    expect(actions.setFilter).toHaveBeenCalledWith('a');
  });
});
