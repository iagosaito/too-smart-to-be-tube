import { describe, expect, it, vi } from 'vitest';
import { el, svgIcon, syncChildren } from '../../src/ui/elements.js';

describe('el', () => {
  it('cria elemento com atributos, classe e filhos', () => {
    const node = el('a', { className: 'x', href: '/y' }, ['texto', el('span', {}, 'filho')]);
    expect(node.outerHTML).toBe('<a class="x" href="/y">texto<span>filho</span></a>');
  });

  it('trata strings como texto, nunca como HTML', () => {
    const node = el('span', {}, '<img src=x onerror=alert(1)>');
    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('registra eventos a partir de props on*', () => {
    const onClick = vi.fn();
    el('button', { onClick }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ignora filhos nulos e trata booleanos como atributos presentes/ausentes', () => {
    const node = el('input', { disabled: true, required: false }, [null]);
    expect(node.hasAttribute('disabled')).toBe(true);
    expect(node.hasAttribute('required')).toBe(false);
  });
});

describe('svgIcon', () => {
  it('cria um SVG no namespace correto', () => {
    const svg = svgIcon('M0 0');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.querySelector('path').getAttribute('d')).toBe('M0 0');
  });

  it('tem tamanho e cor padrão mesmo sem CSS (evita ícone gigante e preto)', () => {
    const svg = svgIcon('M0 0');
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });
});

describe('syncChildren', () => {
  const items = (...names) => names.map((name) => el('li', {}, name));

  it('troca só as posições que mudaram, sem mover os demais nós', () => {
    const [a, b, c] = items('a', 'b', 'c');
    const parent = el('ul', {}, [a, b, c]);
    const [novo] = items('novo');
    syncChildren(parent, [a, novo, c]);
    expect([...parent.children]).toEqual([a, novo, c]);
    expect(b.parentNode).toBeNull();
  });

  it('substitui tudo quando a quantidade muda', () => {
    const [a, b] = items('a', 'b');
    const parent = el('ul', {}, [a]);
    syncChildren(parent, [a, b]);
    expect([...parent.children]).toEqual([a, b]);
  });

  it('lida com reordenação de nós já presentes', () => {
    const [a, b] = items('a', 'b');
    const parent = el('ul', {}, [a, b]);
    syncChildren(parent, [b, a]);
    expect([...parent.children]).toEqual([b, a]);
  });

  it('esvazia quando a lista nova é vazia', () => {
    const parent = el('ul', {}, items('a'));
    syncChildren(parent, []);
    expect(parent.children).toHaveLength(0);
  });
});
