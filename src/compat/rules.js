// src/compat/rules.js
// Machine compatibility rules with structured reason codes

import { toNormalizedSet } from './normalize.js';
import { extractScenarioLabels } from './labels.js';

/**
 * @typedef {Object} CompatReason
 * @property {'NO_SCENARIO'|'MISSING_LABEL'|'ANTI_LABEL_CONFLICT'|'WIDTH_EXCEEDED'|'HEIGHT_EXCEEDED'|'COLORS_EXCEEDED'} code - Reason code
 * @property {string} [label] - Missing label name (for MISSING_LABEL)
 * @property {number} [job] - Job constraint value (for *_EXCEEDED)
 * @property {number} [machine] - Machine limit value (for *_EXCEEDED)
 * @property {string} [wanted] - Wanted label (for ANTI_LABEL_CONFLICT)
 * @property {string} [has] - Conflicting label (for ANTI_LABEL_CONFLICT)
 * @property {string} message - Human-readable message
 */

/**
 * @typedef {Object} CompatResult
 * @property {boolean} ok - True if compatible
 * @property {CompatReason[]} reasons - Detailed reasons for incompatibility
 * @property {string[]} matched - Labels that were matched
 * @property {string[]} missing - Required labels that were missing
 * @property {string} machineId - Machine ID being checked
 * @property {string} [scenarioId] - Scenario ID if found
 * @property {string[]} labels - Available labels on the machine scenario
 */

/**
 * Helper function to safely build a Set from any needed input
 * Ensures no "not iterable" errors
 * @param {any} needed - Raw needed labels input
 * @returns {Set<string>} Normalized needed labels set
 */
export function toNeededSet(needed) {
  if (needed instanceof Set) return needed;
  if (!needed) return new Set();
  if (Array.isArray(needed)) return toNormalizedSet(needed);
  return toNormalizedSet([needed]);
}

/**
 * Compute machine compatibility result
 * @param {any} machine - Machine object with id, nbTetes, maxCouleurs, etc.
 * @param {any} scenario - Scenario object with etiquettes/_labels
 * @param {Set<string>|string[]|string} needed - Required labels (normalized)
 * @param {Object} job - Job constraints {largeurMm?, hauteurMm?, nbCouleurs?, quantite?}
 * @returns {CompatResult} Detailed compatibility result
 */
export function computeMachineCompatibility(machine, scenario, needed, job = {}) {
  const reasons = [];
  const neededSet = toNeededSet(needed);
  const machineId = String(machine?.id || 'unknown');

  // Check if scenario exists
  if (!scenario) {
    reasons.push({
      code: 'NO_SCENARIO',
      message: 'Aucun scénario pour cette machine'
    });
  }

  const labelsSet = scenario ? extractScenarioLabels(scenario) : new Set();
  const labelsArray = Array.from(labelsSet);

  // Check required labels presence
  const matched = [];
  const missing = [];

  for (const requiredLabel of neededSet) {
    if (labelsSet.has(requiredLabel)) {
      matched.push(requiredLabel);
    } else {
      missing.push(requiredLabel);
      reasons.push({
        code: 'MISSING_LABEL',
        label: requiredLabel,
        message: `Étiquette manquante: "${requiredLabel}"`
      });
    }
  }

  // Special rule: Anti-coeur conflict
  // If job wants "coeur" and machine has "anti-coeur" but no "coeur"
  if (neededSet.has('coeur') && labelsSet.has('anti-coeur') && !labelsSet.has('coeur')) {
    reasons.push({
      code: 'ANTI_LABEL_CONFLICT',
      wanted: 'coeur',
      has: 'anti-coeur',
      message: '"anti-coeur" ne couvre pas "coeur"'
    });
  }

  // Check machine constraints
  if (job.largeurMm && machine?.champLargeurMm && job.largeurMm > machine.champLargeurMm) {
    reasons.push({
      code: 'WIDTH_EXCEEDED',
      job: job.largeurMm,
      machine: machine.champLargeurMm,
      message: `Largeur ${job.largeurMm}mm > limite machine ${machine.champLargeurMm}mm`
    });
  }

  if (job.hauteurMm && machine?.champHauteurMm && job.hauteurMm > machine.champHauteurMm) {
    reasons.push({
      code: 'HEIGHT_EXCEEDED',
      job: job.hauteurMm,
      machine: machine.champHauteurMm,
      message: `Hauteur ${job.hauteurMm}mm > limite machine ${machine.champHauteurMm}mm`
    });
  }

  if (job.nbCouleurs && machine?.maxCouleurs && job.nbCouleurs > machine.maxCouleurs) {
    reasons.push({
      code: 'COLORS_EXCEEDED',
      job: job.nbCouleurs,
      machine: machine.maxCouleurs,
      message: `Couleurs ${job.nbCouleurs} > limite machine ${machine.maxCouleurs}`
    });
  }

  return {
    ok: reasons.length === 0,
    reasons,
    matched,
    missing,
    machineId,
    scenarioId: scenario?.id,
    labels: labelsArray
  };
}

// Alias rétro-compatible pour les appels existants isMachineCompatible(machine, scenario, neededSet, jobSpec)
export function isMachineCompatible(machine, scenario, needed, job = {}) {
  return computeMachineCompatibility(machine, scenario, needed, job).ok;
}
