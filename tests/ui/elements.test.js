import { describe, expect, it, vi } from 'vitest';
import { el, svgIcon, syncChildren } from '../../src/ui/elements.js';

describe('el', () => {
  it('creates an element with attributes, class and children', () => {
    const node = el('a', { className: 'x', href: '/y' }, ['texto', el('span', {}, 'filho')]);
    expect(node.outerHTML).toBe('<a class="x" href="/y">texto<span>filho</span></a>');
  });

  it('treats strings as text, never as HTML', () => {
    const node = el('span', {}, '<img src=x onerror=alert(1)>');
    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('registers events from on* props', () => {
    const onClick = vi.fn();
    el('button', { onClick }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ignores null children and treats booleans as present/absent attributes', () => {
    const node = el('input', { disabled: true, required: false }, [null]);
    expect(node.hasAttribute('disabled')).toBe(true);
    expect(node.hasAttribute('required')).toBe(false);
  });
});

describe('svgIcon', () => {
  it('creates an SVG in the right namespace', () => {
    const svg = svgIcon('M0 0');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.querySelector('path').getAttribute('d')).toBe('M0 0');
  });

  it('has a default size and color even without CSS (avoids a huge black icon)', () => {
    const svg = svgIcon('M0 0');
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });
});

describe('syncChildren', () => {
  const items = (...names) => names.map((name) => el('li', {}, name));

  it('swaps only the positions that changed, without moving the other nodes', () => {
    const [a, b, c] = items('a', 'b', 'c');
    const parent = el('ul', {}, [a, b, c]);
    const [novo] = items('novo');
    syncChildren(parent, [a, novo, c]);
    expect([...parent.children]).toEqual([a, novo, c]);
    expect(b.parentNode).toBeNull();
  });

  it('replaces everything when the count changes', () => {
    const [a, b] = items('a', 'b');
    const parent = el('ul', {}, [a]);
    syncChildren(parent, [a, b]);
    expect([...parent.children]).toEqual([a, b]);
  });

  it('handles reordering of nodes already present', () => {
    const [a, b] = items('a', 'b');
    const parent = el('ul', {}, [a, b]);
    syncChildren(parent, [b, a]);
    expect([...parent.children]).toEqual([b, a]);
  });

  it('empties when the new list is empty', () => {
    const parent = el('ul', {}, items('a'));
    syncChildren(parent, []);
    expect(parent.children).toHaveLength(0);
  });
});
