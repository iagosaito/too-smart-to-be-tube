// A página é re-renderizada por inteiro a cada mudança (mais simples de
// manter do que atualizações pontuais). Sem isto, digitar na busca perderia o
// foco a cada tecla. Elementos marcados com data-focus-key recuperam foco e cursor.
export function preserveFocus(root, render) {
  const active = document.activeElement;
  const key = active && root.contains(active) ? active.dataset.focusKey : undefined;
  const caret = typeof active?.selectionStart === 'number' ? active.selectionStart : null;
  render();
  if (!key) return;
  // Caminho rápido: se o próprio elemento sobreviveu ao render, basta reafirmar o foco.
  if (active.isConnected) {
    if (document.activeElement !== active) active.focus();
    return;
  }
  const next = [...root.querySelectorAll('[data-focus-key]')].find((node) => node.dataset.focusKey === key);
  next?.focus();
  if (caret !== null) next?.setSelectionRange?.(caret, caret);
}
