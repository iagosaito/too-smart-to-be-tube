const DELIMITERS = [',', ';', '\t'];

// Detects the separator from the header row: Excel in Portuguese saves CSV with ";" and the user
// may have edited the exported file in it.
export function detectDelimiter(text) {
  // The same line breaks the parser accepts, including a lone "\r".
  const header = text.split(/\r\n|\n|\r/, 1)[0];
  const counts = DELIMITERS.map((delimiter) => header.split(delimiter).length - 1);
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] > 0 ? DELIMITERS[best] : ',';
}

// Single-pass state machine (linear time). The previous version used a regex that, with a long cell
// followed by a lone "\r", backtracked through every possible length: quadratic time, and a
// malicious 5 MB CSV froze the YouTube tab.
export function parseCsv(text) {
  // The BOM the export adds must not become part of the first column's name.
  const body = String(text).replace(/^\uFEFF/, '');
  const state = { delimiter: detectDelimiter(body), rows: [], row: [], cell: '', quoted: false };
  for (let index = 0; index < body.length; index += 1) index = step(state, body, index);
  endRow(state);
  // Blank lines (e.g. the end of the file) carry no information.
  return state.rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

// Returns the index of the last character consumed (some steps consume two).
function step(state, body, index) {
  if (state.quoted) return stepQuoted(state, body, index);
  const char = body[index];
  // Quotes only open a quoted cell at its start; in the middle they are plain text.
  if (char === '"' && state.cell === '') state.quoted = true;
  else if (char === state.delimiter) endCell(state);
  else if (char === '\n' || char === '\r') {
    endRow(state);
    // "\r\n" (Windows/Excel) is a single break; a lone "\r" also counts as a break.
    if (char === '\r' && body[index + 1] === '\n') return index + 1;
  } else state.cell += char;
  return index;
}

function stepQuoted(state, body, index) {
  if (body[index] !== '"') state.cell += body[index];
  // "" inside quotes is a literal quote.
  else if (body[index + 1] === '"') {
    state.cell += '"';
    return index + 1;
  } else state.quoted = false;
  return index;
}

function endCell(state) {
  state.row.push(state.cell);
  state.cell = '';
}

function endRow(state) {
  endCell(state);
  state.rows.push(state.row);
  state.row = [];
}
