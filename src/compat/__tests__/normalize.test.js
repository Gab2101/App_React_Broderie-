import { describe, it, expect } from 'vitest';
import { normalizeLabel, toNormalizedArray, toNormalizedSet } from '../normalize.js';

describe('normalizeLabel core functionality', () => {
  it('should normalize basic clothing types', () => {
    expect(normalizeLabel('Tshirt')).toBe('t-shirt');
    expect(normalizeLabel('TEE')).toBe('t-shirt');
    expect(normalizeLabel('bonnet')).toBe('bonnet');
    expect(normalizeLabel('Devant')).toBe('devant');
  });

  it('should handle accents properly for compatibility', () => {
    expect(normalizeLabel('Cœur')).toBe('coeur');
    expect(normalizeLabel('Téé-shirt')).toBe('t-shirt'); // Unicode normalization works
    expect(normalizeLabel('BONNET')).toBe('bonnet');
  });

  it('should handle basic punctuation removal', () => {
    expect(normalizeLabel('BONNET...')).toBe('bonnet');
    expect(normalizeLabel('t_shirt')).toBe('t-shirt');
  });

  it('should apply synonym mappings', () => {
    expect(normalizeLabel('Tee')).toBe('t-shirt');
    expect(normalizeLabel('cœur')).toBe('coeur');
    expect(normalizeLabel('ts')).toBe('t-shirt');
  });

  it('should handle empty/null inputs', () => {
    expect(normalizeLabel('')).toBe('');
    expect(normalizeLabel(null)).toBe('');
    expect(normalizeLabel(undefined)).toBe('');
  });
});

describe('toNormalizedArray basic functionality', () => {
  it('should handle string arrays', () => {
    expect(toNormalizedArray(['Tshirt', 'Cœur', 'Devant'])).toEqual(['t-shirt', 'coeur', 'devant']);
  });

  it('should handle basic comma-separated strings', () => {
    expect(toNormalizedArray('Tshirt, Cœur, Devant')).toEqual(['t-shirt', 'coeur', 'devant']);
    expect(toNormalizedArray('tshirt cœur')).toEqual(['t-shirt', 'coeur']);
  });

  it('should handle single string values', () => {
    expect(toNormalizedArray('Tshirt')).toEqual(['t-shirt']);
  });

  it('should handle null/undefined inputs', () => {
    expect(toNormalizedArray(null)).toEqual([]);
    expect(toNormalizedArray(undefined)).toEqual([]);
  });
});

describe('toNormalizedSet functionality', () => {
  it('should return a Set of normalized values', () => {
    const result = toNormalizedSet(['Tshirt', 'Cœur', 'bonnet']);
    expect(result).toBeInstanceOf(Set);
    expect(Array.from(result)).toEqual(['t-shirt', 'coeur', 'bonnet']);
  });

  it('should handle string inputs', () => {
    const result = toNormalizedSet('Tshirt, Cœur');
    expect(Array.from(result)).toEqual(['t-shirt', 'coeur']);
  });

  it('should deduplicate synonym values', () => {
    const result = toNormalizedSet(['Tshirt', 'tee', 't-shirt']);
    expect(Array.from(result)).toEqual(['t-shirt']); // All synonyms map to 't-shirt'
  });
});
