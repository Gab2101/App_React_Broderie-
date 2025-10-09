// src/Pages/Admin/Commandes/utils/labels.js
// Re-exports from compat system for backward compatibility

export { normalizeLabel, toNormalizedSet } from '@/compat/normalize';

/** Legacy compatibility - ensures array output */
export function toLabelArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

export function scenarioLabels(scen) {
  if (!scen) return new Set();
  if (Array.isArray(scen._labels)) return toNormalizedSet(scen._labels);
  let arr = [];
  if (typeof scen.etiquettes === 'string') {
    try { arr = JSON.parse(scen.etiquettes); } catch { arr = []; }
  } else if (Array.isArray(scen.etiquettes)) {
    arr = scen.etiquettes;
  }
  return toNormalizedSet(arr);
}
