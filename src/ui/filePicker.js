import { el } from './elements.js';

// Abre o seletor de arquivos nativo a partir de um clique. Um <input type=file>
// temporário evita manter um campo escondido na página do YouTube.
export function pickFile(accept = '.csv,text/csv') {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, hidden: true });
    const finish = (file) => {
      input.remove();
      resolve(file ?? null);
    };
    input.addEventListener('change', () => finish(input.files?.[0]));
    // "cancel" dispara quando o usuário fecha o seletor sem escolher nada;
    // sem isso a Promise ficaria pendente e o input órfão na página.
    input.addEventListener('cancel', () => finish(null));
    document.body.append(input);
    input.click();
  });
}
