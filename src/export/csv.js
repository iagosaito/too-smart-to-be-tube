// BOM UTF-8: sem ele o Excel (e às vezes o LibreOffice) abre o arquivo como
// Latin-1 e nomes como "Música" viram "MÃºsica".
const BOM = '﻿';
// Planilhas interpretam células que começam com estes caracteres como
// fórmula. Nomes de canais são texto de terceiros, então neutralizamos.
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCell(value) {
  const text = String(value ?? '');
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  // Aspas só quando necessário (RFC 4180): mantém o arquivo legível em texto puro.
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows) {
  // \r\n é o separador de linha do RFC 4180 e o que o Excel espera.
  return BOM + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
