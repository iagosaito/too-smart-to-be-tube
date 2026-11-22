import { beforeEach, describe, expect, it } from 'vitest';
import { preserveFocus } from '../../src/ui/focus.js';

const input = (value = '') => Object.assign(document.createElement('input'), { value });

function keyedInput(key, value) {
  const node = input(value);
  node.dataset.focusKey = key;
  return node;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
});

const root = () => document.getElementById('root');

describe('preserveFocus', () => {
  it('devolve foco e cursor ao elemento com a mesma chave após re-renderizar', () => {
    const before = keyedInput('search', 'abcdef');
    root().append(before);
    before.focus();
    before.setSelectionRange(3, 3);

    const after = keyedInput('search', 'abcdef');
    preserveFocus(root(), () => root().replaceChildren(after));

    expect(document.activeElement).toBe(after);
    expect(after.selectionStart).toBe(3);
  });

  it('não rouba o foco quando ele estava fora da raiz', () => {
    const outside = keyedInput('search', '');
    document.body.append(outside);
    outside.focus();
    const after = keyedInput('search', '');
    preserveFocus(root(), () => root().replaceChildren(after));
    expect(document.activeElement).toBe(outside);
  });

  it('não falha quando o elemento focado não tem chave', () => {
    const plain = input();
    root().append(plain);
    plain.focus();
    expect(() => preserveFocus(root(), () => root().replaceChildren())).not.toThrow();
  });
});
