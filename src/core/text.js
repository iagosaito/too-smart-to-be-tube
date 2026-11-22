// Fica no core porque busca (UI) e importação comparam nomes da mesma forma.
export function normalizeText(text) {
  // Remove acentos para que "musica" encontre "Música".
  return String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();
}
