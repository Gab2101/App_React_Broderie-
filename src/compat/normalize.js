// src/compat/normalize.js
// Label normalization and synonyms pipeline
// Case-insensitive, accent-insensitive, synonym-aware normalization

/**
 * Comprehensive synonym mapping for label normalization
 * @type {Record<string, string>}
 */
export const SYNONYMS = {
  // T-shirt variations
  'tshirt': 't-shirt',
  'tee': 't-shirt',
  'tee-shirt': 't-shirt',
  'tee shirt': 't-shirt',
  'ts': 't-shirt',

  // Heart/cœur variations
  'coeur': 'coeur',
  'cœur': 'coeur',

  // Common item types
  'bonnet': 'bonnet',

  // Embroidery locations
  'devant': 'devant',
  'dos': 'dos',
  'manche': 'manche',
  'poche': 'poche',
  'casquette': 'casquette',
  'serviette': 'serviette',
  'nuque': 'nuque',

  // Special cases
  'emplacement-simple': 'emplacement-simple',
};

/**
 * Normalize a single label string
 * Handles accents, case, punctuation, and synonym resolution
 * @param {unknown} input - Any input value
 * @returns {string} Normalized lowercase label without accents/punctuation
 */
export function normalizeLabel(input) {
  if (!input) return '';

  // Convert to string and normalize unicode (handle accents: œ → oe, é → e)
  let str = String(input);
  str = str.normalize('NFD').replace(/\p{Diacritic}/gu, '');

  // Convert to lowercase, replace underscores with hyphens
  str = str.toLowerCase().replace(/_/g, '-');

  // Remove all punctuation except hyphens
  str = str.replace(/[^\p{Letter}\p{Number}\s-]/gu, '');

  // Collapse whitespace and normalize spaces to single hyphens
  str = str.replace(/\s+/g, ' ').trim();
  str = str.replace(/\s*-\s*/g, '-').replace(/-+/g, '-');

  // Apply synonyms
  return SYNONYMS[str] || str;
}

/**
 * Convert any input to a normalized string array
 * @param {unknown} input - String, array, or other input
 * @returns {string[]} Array of normalized strings
 */
export function toNormalizedArray(input) {
  if (!input) return [];

  // Handle arrays
  if (Array.isArray(input)) {
    return input
      .filter(item => item != null)
      .map(item => normalizeLabel(item))
      .filter(label => label.length > 0);
  }

  // Handle strings (may contain spaces or commas)
  if (typeof input === 'string') {
    return input
      .split(/[\s,]+/)
      .filter(item => item.trim())
      .map(item => normalizeLabel(item.trim()));
  }

  // Handle other types by converting to string first
  return [normalizeLabel(input)];
}

/**
 * Convert any input to a normalized Set for fast lookups
 * @param {unknown} input - String, array, or other input
 * @returns {Set<string>} Set of normalized strings
 */
export function toNormalizedSet(input) {
  return new Set(toNormalizedArray(input));
}
