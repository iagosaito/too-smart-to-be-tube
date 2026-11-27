// UTF-8 BOM: without it Excel (and sometimes LibreOffice) opens the file as Latin-1 and names like
// "Música" turn into "MÃºsica".
const BOM = '﻿';
// Spreadsheets treat cells starting with these characters as formulas. Channel names are
// third-party text, so we neutralize them.
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCell(value) {
  const text = String(value ?? '');
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  // Quotes only when needed (RFC 4180): keeps the file readable as plain text.
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows) {
  // \r\n is RFC 4180's line separator and what Excel expects.
  return BOM + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
