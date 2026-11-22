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

// Regressão (ReDoS): uma célula longa seguida de "\r" sozinho fazia a regex
// do parser recuar em todos os comprimentos possíveis, com tempo quadrático:
// um CSV malicioso de 5 MB travaria a aba do YouTube por horas.
describe('parseCsv com entradas hostis', () => {
  it('trata "\\r" sozinho como quebra de linha', () => {
    expect(parseCsv('a,b\rc,d\r')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('lê uma célula longa terminada em "\\r" sozinho em tempo linear', () => {
    const text = 'Channel,Category\n' + 'a'.repeat(30_000) + '\rx';
    const start = performance.now();
    const rows = parseCsv(text);
    expect(performance.now() - start).toBeLessThan(100);
    expect(rows).toEqual([['Channel', 'Category'], ['a'.repeat(30_000)], ['x']]);
  });

  it('lê um arquivo de ~5 MB em menos de 1 segundo', () => {
    const line = 'Some Channel Name,Category,https://www.youtube.com/@channel,/@channel\r\n';
    const text = 'Channel,Category,URL,Identifier\r\n' + line.repeat(Math.floor(5_000_000 / line.length));
    const start = performance.now();
    parseCsv(text);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
