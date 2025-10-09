// src/compat/labels.js
// Scenario label extraction and job specification handling

import { toNormalizedSet, toNormalizedArray } from './normalize.js';

/**
 * Extract normalized labels from a scenario object
 * Tries _labels first (pre-computed), then etiquettes field
 * @param {any} scenario - Scenario object with _labels or etiquettes
 * @returns {Set<string>} Normalized labels set for fast lookups
 */
export function extractScenarioLabels(scenario) {
  if (!scenario || typeof scenario !== 'object') return new Set();

  // Try _labels first (already computed, most efficient)
  if (Array.isArray(scenario._labels)) {
    return toNormalizedSet(scenario._labels);
  }

  // Try etiquettes field
  if (scenario.etiquettes) {
    let labels = [];

    // Handle array format
    if (Array.isArray(scenario.etiquettes)) {
      labels = scenario.etiquettes;
    }
    // Handle string format (JSON or comma-separated)
    else if (typeof scenario.etiquettes === 'string') {
      try {
        // Try JSON first
        labels = JSON.parse(scenario.etiquettes);
        if (!Array.isArray(labels)) {
          labels = [String(labels)];
        }
      } catch {
        // Fallback to comma/semicolon/space separated
        labels = scenario.etiquettes.split(/[,;\s]+/);
      }
    }
    // Handle other types
    else {
      labels = [String(scenario.etiquettes)];
    }

    return toNormalizedSet(labels);
  }

  return new Set();
}

/**
 * Build a normalized set of needed labels from job specification
 * Combines both types (articles) and options (broderie techniques)
 * Machines must have ALL required tags (types + options)
 * @param {any} job - Job specification with types, options, largeurMm, hauteurMm, nbCouleurs
 * @returns {Set<string>} Normalized labels set for compatibility checking
 */
export function buildNeededSet(job) {
  if (!job || typeof job !== 'object') return new Set();

  const allLabels = [];

  // Extract types (articles) - required for basic compatibility
  const rawTypes = job.types;
  if (Array.isArray(rawTypes)) {
    allLabels.push(...rawTypes);
  } else if (typeof rawTypes === 'string') {
    const labels = rawTypes.split(/[,;\s]+/).filter(s => s.trim());
    allLabels.push(...labels);
  }

  // Extract options (broderie techniques) - also required for compatibility
  const rawOptions = job.options;
  if (Array.isArray(rawOptions)) {
    allLabels.push(...rawOptions);
  } else if (typeof rawOptions === 'string') {
    const labels = rawOptions.split(/[,;\s]+/).filter(s => s.trim());
    allLabels.push(...labels);
  }

  // Normalize and return as Set (removes duplicates, normalizes case)
  return toNormalizedSet(allLabels);
}
