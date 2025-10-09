import { describe, it, expect } from 'vitest';
import { normalizeLabel, toNormalizedSet } from '@/Pages/Admin/Commandes/utils/labels';

describe('normalizeLabel', () => {
  it('should handle basic normalization', () => {
    expect(normalizeLabel('Tshirt')).toBe('t-shirt');
    expect(normalizeLabel('tee-shirt')).toBe('t-shirt');
    expect(normalizeLabel('coeur')).toBe('coeur');
    expect(normalizeLabel('cœur')).toBe('coeur');
  });

  it('should normalize various forms', () => {
    expect(normalizeLabel('Tshirt')).toBe('t-shirt');
    expect(normalizeLabel('tee-shirt')).toBe('t-shirt');
    expect(normalizeLabel('tee shirt')).toBe('t-shirt');
    expect(normalizeLabel('TS')).toBe('t-shirt');
  });

  it('should handle accents and diacritics', () => {
    expect(normalizeLabel('cœur')).toBe('coeur');
    expect(normalizeLabel('Cœur')).toBe('coeur');
    expect(normalizeLabel('CŒUR')).toBe('coeur');
  });
});

describe('toNormalizedSet', () => {
  it('should convert array to normalized set', () => {
    const result = toNormalizedSet(['Tshirt', 'cœur', 'T-Shirt']);
    expect(result.has('t-shirt')).toBe(true);
    expect(result.has('coeur')).toBe(true);
    expect(result.size).toBe(2); // 't-shirt' and 'coeur' (different normalized labels)
  });

  it('should handle empty arrays', () => {
    const result = toNormalizedSet([]);
    expect(result.size).toBe(0);
  });
});
