const DELIMITERS = [',', ';', '\t'];

// Detecta o separador pela linha de cabeçalho: o Excel em português salva
// CSV com ";" e o usuário pode ter editado o arquivo exportado nele.
export function detectDelimiter(text) {
  // Mesmas quebras de linha que o parser aceita, inclusive "\r" sozinho.
  const header = text.split(/\r\n|\n|\r/, 1)[0];
  const counts = DELIMITERS.map((delimiter) => header.split(delimiter).length - 1);
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] > 0 ? DELIMITERS[best] : ',';
}

// Máquina de estados de uma passada só (tempo linear). A versão anterior
// usava uma regex que, com uma célula longa seguida de "\r" sozinho, recuava
// em todos os comprimentos possíveis: tempo quadrático, e um CSV malicioso de
// 5 MB travava a aba do YouTube.
export function parseCsv(text) {
  // O BOM que a exportação adiciona não pode virar parte do nome da primeira coluna.
  const body = String(text).replace(/^\uFEFF/, '');
  const state = { delimiter: detectDelimiter(body), rows: [], row: [], cell: '', quoted: false };
  for (let index = 0; index < body.length; index += 1) index = step(state, body, index);
  endRow(state);
  // Linhas em branco (ex.: final do arquivo) não carregam informação.
  return state.rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

// Devolve o índice do último caractere consumido (alguns passos consomem dois).
function step(state, body, index) {
  if (state.quoted) return stepQuoted(state, body, index);
  const char = body[index];
  // Aspas só abrem uma célula entre aspas no início dela; no meio são texto comum.
  if (char === '"' && state.cell === '') state.quoted = true;
  else if (char === state.delimiter) endCell(state);
  else if (char === '\n' || char === '\r') {
    endRow(state);
    // "\r\n" (Windows/Excel) é uma quebra só; "\r" sozinho também conta como quebra.
    if (char === '\r' && body[index + 1] === '\n') return index + 1;
  } else state.cell += char;
  return index;
}

function stepQuoted(state, body, index) {
  if (body[index] !== '"') state.cell += body[index];
  // "" dentro de aspas é uma aspa literal.
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
