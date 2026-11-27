import { el } from './elements.js';

// Download done in the page itself with Blob + <a download>: no need for Chrome's "downloads"
// permission, keeping the extension's permissions minimal.
export function downloadTextFile(fileName, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el('a', { href: url, download: fileName, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  // Deferred because revoking right away may cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
