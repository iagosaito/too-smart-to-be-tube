import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from '../../src/import/csvParse.js';
import { toCsv } from '../../src/export/csv.js';

describe('detectDelimiter', () => {
  it.each([
    ['a,b,c\n1,2,3', ','],
    ['a;b;c\n1;2;3', ';'],
    ['a\tb\n1\t2', '\t'],
    ['sozinho', ','],
  ])('detecta o separador de %j', (text, expected) => {
    expect(detectDelimiter(text)).toBe(expected);
  });
});

describe('parseCsv', () => {
  it('lê linhas com \\n ou \\r\\n e ignora linhas em branco', () => {
    expect(parseCsv('a,b\r\n1,2\n\n3,4\r\n')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('remove o BOM do início', () => {
    expect(parseCsv('﻿Canal,Categoria\nA,B')[0]).toEqual(['Canal', 'Categoria']);
  });

  it('entende aspas com separador, aspas escapadas e quebra de linha', () => {
    expect(parseCsv('"a, b","diz ""oi""","duas\nlinhas"')).toEqual([['a, b', 'diz "oi"', 'duas\nlinhas']]);
  });

  it('aceita ponto e vírgula (Excel em português)', () => {
    expect(parseCsv('Canal;Categoria\r\n"Nome; com ponto";Tech')).toEqual([['Canal', 'Categoria'], ['Nome; com ponto', 'Tech']]);
  });

  it('mantém células vazias', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('faz o caminho de volta do que a exportação gera', () => {
    const rows = [['Canal', 'Categoria'], ['A, "B"', 'Música'], ['Linha\nquebrada', '']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
