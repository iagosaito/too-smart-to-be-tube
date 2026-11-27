import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from '../../src/import/csvParse.js';
import { toCsv } from '../../src/export/csv.js';

describe('detectDelimiter', () => {
  it.each([
    ['a,b,c\n1,2,3', ','],
    ['a;b;c\n1;2;3', ';'],
    ['a\tb\n1\t2', '\t'],
    ['sozinho', ','],
    ['a;b\rc,d,e,f', ';'],
  ])('detects the separator of %j', (text, expected) => {
    expect(detectDelimiter(text)).toBe(expected);
  });
});

describe('parseCsv', () => {
  it('reads rows with \\n or \\r\\n and ignores blank lines', () => {
    expect(parseCsv('a,b\r\n1,2\n\n3,4\r\n')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('removes the BOM at the start', () => {
    expect(parseCsv('﻿Canal,Categoria\nA,B')[0]).toEqual(['Canal', 'Categoria']);
  });

  it('understands quotes with a separator, escaped quotes and line breaks', () => {
    expect(parseCsv('"a, b","diz ""oi""","duas\nlinhas"')).toEqual([['a, b', 'diz "oi"', 'duas\nlinhas']]);
  });

  it('accepts semicolons (Excel in Portuguese)', () => {
    expect(parseCsv('Canal;Categoria\r\n"Nome; com ponto";Tech')).toEqual([['Canal', 'Categoria'], ['Nome; com ponto', 'Tech']]);
  });

  it('keeps empty cells', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('round-trips what the export generates', () => {
    const rows = [['Canal', 'Categoria'], ['A, "B"', 'Música'], ['Linha\nquebrada', '']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

// Regression (ReDoS): a long cell followed by a lone "\r" made the parser's regex backtrack through
// every possible length, in quadratic time: a malicious 5 MB CSV would freeze the YouTube tab for
// hours.
describe('parseCsv with hostile input', () => {
  it('treats a lone "\\r" as a line break', () => {
    expect(parseCsv('a,b\rc,d\r')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('reads a long cell ending in a lone "\\r" in linear time', () => {
    const text = 'Channel,Category\n' + 'a'.repeat(30_000) + '\rx';
    const start = performance.now();
    const rows = parseCsv(text);
    expect(performance.now() - start).toBeLessThan(100);
    expect(rows).toEqual([['Channel', 'Category'], ['a'.repeat(30_000)], ['x']]);
  });

  it('reads a ~5 MB file in under 1 second', () => {
    const line = 'Some Channel Name,Category,https://www.youtube.com/@channel,/@channel\r\n';
    const text = 'Channel,Category,URL,Identifier\r\n' + line.repeat(Math.floor(5_000_000 / line.length));
    const start = performance.now();
    parseCsv(text);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
