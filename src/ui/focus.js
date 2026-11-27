// The page is fully re-rendered on every change (simpler to maintain than targeted updates).
// Without this, typing in the search would lose focus on every keystroke. Elements marked with
// data-focus-key get their focus and cursor back.
export function preserveFocus(root, render) {
  const active = document.activeElement;
  const key = active && root.contains(active) ? active.dataset.focusKey : undefined;
  const caret = typeof active?.selectionStart === 'number' ? active.selectionStart : null;
  render();
  if (!key) return;
  // Fast path: if the element itself survived the render, just reassert the focus.
  if (active.isConnected) {
    if (document.activeElement !== active) active.focus();
    return;
  }
  const next = [...root.querySelectorAll('[data-focus-key]')].find((node) => node.dataset.focusKey === key);
  next?.focus();
  if (caret !== null) next?.setSelectionRange?.(caret, caret);
}
