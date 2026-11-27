// Lives in core because search (UI) and import compare names the same way.
export function normalizeText(text) {
  // Strips accents so that "musica" finds "Música".
  return String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();
}
