const DELIMITERS = [',', ';', '\t'];

// Detecta o separador pela linha de cabeçalho: o Excel em português salva
// CSV com ";" e o usuário pode ter editado o arquivo exportado nele.
export function detectDelimiter(text) {
  const header = text.split(/\r?\n/, 1)[0];
  const counts = DELIMITERS.map((delimiter) => header.split(delimiter).length - 1);
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] > 0 ? DELIMITERS[best] : ',';
}

export function parseCsv(text) {
  // O BOM que a exportação adiciona não pode virar parte do nome da primeira coluna.
  const body = String(text).replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(body);
  const rows = [[]];
  for (const [, raw, separator] of body.matchAll(cellPattern(delimiter))) {
    rows.at(-1).push(unquote(raw));
    if (separator === '') break;
    if (separator !== delimiter) rows.push([]);
  }
  // Linhas em branco (ex.: final do arquivo) não carregam informação.
  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

function cellPattern(delimiter) {
  // Célula entre aspas (com "" escapado, podendo ter quebras de linha) ou
  // célula simples, seguida do separador, de uma quebra de linha ou do fim.
  const d = delimiter === '\t' ? '\\t' : delimiter;
  return new RegExp(`("(?:[^"]|"")*"|[^${d}\\r\\n]*)(${d}|\\r?\\n|$)`, 'g');
}

function unquote(raw) {
  const quoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"');
  return quoted ? raw.slice(1, -1).replaceAll('""', '"') : raw;
}
