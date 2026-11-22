import { describe, expect, it } from 'vitest';
import { escapeCell, toCsv } from '../../src/export/csv.js';

describe('escapeCell', () => {
  it('mantém texto simples sem aspas', () => {
    expect(escapeCell('Alura')).toBe('Alura');
  });

  it.each([
    ['vírgula, aqui', '"vírgula, aqui"'],
    ['diz "oi"', '"diz ""oi"""'],
    ['duas\nlinhas', '"duas\nlinhas"'],
  ])('protege %j', (input, expected) => {
    expect(escapeCell(input)).toBe(expected);
  });

  it('converte null/undefined em vazio', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });

  it.each(['=HYPERLINK("x")', '+1', '-2', '@SOMA(A1)'])('neutraliza fórmula em %j', (input) => {
    expect(escapeCell(input).replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('neutraliza fórmula e ainda escapa aspas', () => {
    expect(escapeCell('=1,"a"')).toBe('"\'=1,""a"""');
  });
});

describe('toCsv', () => {
  it('começa com BOM e usa \\r\\n entre linhas e no fim', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('﻿a,b\r\nc,d\r\n');
  });
});
