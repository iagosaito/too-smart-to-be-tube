import { describe, expect, it } from 'vitest';
import { escapeCell, toCsv } from '../../src/export/csv.js';

describe('escapeCell', () => {
  it('keeps plain text without quotes', () => {
    expect(escapeCell('Alura')).toBe('Alura');
  });

  it.each([
    ['vírgula, aqui', '"vírgula, aqui"'],
    ['diz "oi"', '"diz ""oi"""'],
    ['duas\nlinhas', '"duas\nlinhas"'],
  ])('protects %j', (input, expected) => {
    expect(escapeCell(input)).toBe(expected);
  });

  it('turns null/undefined into empty', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });

  it.each(['=HYPERLINK("x")', '+1', '-2', '@SOMA(A1)'])('neutralizes a formula in %j', (input) => {
    expect(escapeCell(input).replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('neutralizes a formula and still escapes quotes', () => {
    expect(escapeCell('=1,"a"')).toBe('"\'=1,""a"""');
  });
});

describe('toCsv', () => {
  it('starts with a BOM and uses \\r\\n between rows and at the end', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('﻿a,b\r\nc,d\r\n');
  });
});
