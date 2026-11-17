import { describe, expect, it } from 'vitest';

import { specLines } from './spec';

describe('specLines', () => {
  it('splits a value at its separator dots and drops them', () => {
    expect(specLines('Intel Core i5-13500 · 14C / 20T')).toEqual([
      'Intel Core i5-13500',
      '14C / 20T',
    ]);
  });

  it('handles more than one separator', () => {
    expect(specLines('a · b · c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a value without separators as one line', () => {
    expect(specLines('10 GbE')).toEqual(['10 GbE']);
  });

  it('ignores a dot without surrounding spaces', () => {
    expect(specLines('a·b')).toEqual(['a·b']);
  });

  it('drops empty parts and trims whitespace', () => {
    expect(specLines('  a ·  · b  ')).toEqual(['a', 'b']);
  });

  it('returns nothing for an empty value', () => {
    expect(specLines('')).toEqual([]);
  });
});
