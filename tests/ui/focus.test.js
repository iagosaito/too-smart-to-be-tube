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
  it('returns focus and cursor to the element with the same key after a re-render', () => {
    const before = keyedInput('search', 'abcdef');
    root().append(before);
    before.focus();
    before.setSelectionRange(3, 3);

    const after = keyedInput('search', 'abcdef');
    preserveFocus(root(), () => root().replaceChildren(after));

    expect(document.activeElement).toBe(after);
    expect(after.selectionStart).toBe(3);
  });

  it("doesn't steal focus when it was outside the root", () => {
    const outside = keyedInput('search', '');
    document.body.append(outside);
    outside.focus();
    const after = keyedInput('search', '');
    preserveFocus(root(), () => root().replaceChildren(after));
    expect(document.activeElement).toBe(outside);
  });

  it("doesn't fail when the focused element has no key", () => {
    const plain = input();
    root().append(plain);
    plain.focus();
    expect(() => preserveFocus(root(), () => root().replaceChildren())).not.toThrow();
  });
});
