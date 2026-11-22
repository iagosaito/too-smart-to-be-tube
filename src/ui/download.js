import { el } from './elements.js';

// Download feito na própria página com Blob + <a download>: dispensa a
// permissão "downloads" do Chrome, mantendo a extensão com permissões mínimas.
export function downloadTextFile(fileName, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el('a', { href: url, download: fileName, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  // Adiado porque revogar na hora pode cancelar o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
