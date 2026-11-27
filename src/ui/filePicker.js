import { el } from './elements.js';

// Opens the native file picker from a click. A temporary <input type=file> avoids keeping a hidden
// field on the YouTube page.
export function pickFile(accept = '.csv,text/csv') {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, hidden: true });
    const finish = (file) => {
      input.remove();
      resolve(file ?? null);
    };
    input.addEventListener('change', () => finish(input.files?.[0]));
    // "cancel" fires when the user closes the picker without choosing anything; without it the
    // Promise would stay pending and the input orphaned on the page.
    input.addEventListener('cancel', () => finish(null));
    document.body.append(input);
    input.click();
  });
}
