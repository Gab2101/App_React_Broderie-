// src/utils/calculator/previewCalculator.js
// Pure calculator functions - extracted from modal components for performance
// No React dependencies or hooks - pure business logic only

import { roundMinutesTo5 } from '@/Pages/Admin/Commandes/utils/timeRealtime.js';

/**
 * Factor for calculating machine head parallelization
 * @param {Object} params - Factor calculation parameters
 * @param {number} params.targetHeads - Machine head count
 * @param {number} params.baseHeads - Scenario base head count
 * @param {number} params.qty - Production quantity
 * @returns {number} Parallelization factor (>1 = more time, <1 = less time)
 */
export function headsFactor({ targetHeads, baseHeads, qty }) {
  const q = Math.max(1, Number(qty || 1));
  const effTarget = Math.max(1, Math.min(Number(targetHeads || 1), q));
  const effBase   = Math.max(1, Math.min(Number(baseHeads  || 1), q));
  return effBase / effTarget; // >1 = more long, <1 = less time
}

/**
 * Compute preview minutes for a machine/scenario combination
 * Pure function - no React dependencies
 * @param {Object} params - Calculation parameters
 * @param {Object} params.scenario - Machine scenario data
 * @param {Object} params.machine - Machine data
 * @param {number} params.percentBroderie - Percentage (50-500)
 * @param {boolean} params.isMono - Whether machine is single-head
 * @param {number} params.monoUnitsUsed - Units used for single-head machines
 * @param {Object} params.selectedScenario - Reference scenario
 * @param {Object} params.formData - Form data for calculations
 * @returns {Object} Preview calculation results
 */
export function computePreviewMinutes({
  scenario,
  machine,
  percentBroderie, // 50–500 (pas 5)
  isMono,
  monoUnitsUsed = 1,
  selectedScenario,
  formData
}) {
  // Validate inputs
  if (!scenario || !machine) {
    return {
      broderieTheoAdj: 0,
      nettoyageApplique: 0,
      totalTheoAdj: 0,
      broderieAppliquee: 0,
      totalApplique: 0,
      coefTotalEquivalent: 100,
    };
  }

  // Extract theoretical minutes from scenario
  const broderieMin = extractTheoMinutesFromScenario(scenario).broderieMin;
  const nettoyageMin = extractTheoMinutesFromScenario(scenario).nettoyageMin;

  // Calculate production quantity and head counts
  const qty = Number(formData?.quantite || formData?.qte || 1);
  const targetHeads = Number(machine?.nbTetes || 1);
  const baseHeads = Number(scenario?.machine?.nbTetes || selectedScenario?.machine?.nbTetes || 1);

  // Calculate parallelization factor
  const factor = headsFactor({ targetHeads, baseHeads, qty });

  // Apply parallelization to broderie minutes
  let broderieTheo = broderieMin;
  if (!scenario?.machine || String(scenario?.machine?.id) !== String(machine?.id)) {
    broderieTheo = roundMinutesTo5(Math.round(broderieMin * factor));
  }

  // Handle per-piece calculations for large quantities
  if (scenario?.perPieceMinutes && qty > targetHeads) {
    const perPieceMin = Number(scenario.perPieceMinutes);
    const cycles = Math.ceil(qty / targetHeads);
    broderieTheo = roundMinutesTo5(perPieceMin * cycles);
  }

  // Add color change penalties
  let colorChangePenalty = 0;
  if (formData?.nbCouleurs && machine?.tempsChangementCouleurMin) {
    const colorChanges = Math.max(0, Number(formData.nbCouleurs) - 1);
    colorChangePenalty = roundMinutesTo5(colorChanges * Number(machine.tempsChangementCouleurMin));
  }
  broderieTheo = roundMinutesTo5(broderieTheo + colorChangePenalty);

  // Apply single-head parallelization
  const units = isMono ? Math.max(1, Number(monoUnitsUsed || 1)) : 1;
  const broderieTheoAdj = Math.round(broderieTheo / units);

  // Apply broderie percentage (this is the main coefficient)
  const coef = Math.max(0, Math.min(500, Number(percentBroderie || 100)));
  const broderieAppliquee = roundMinutesTo5(Math.round((broderieTheoAdj * coef) / 100));

  // Nettoyage remains unchanged
  const nettoyageApplique = roundMinutesTo5(nettoyageMin);

  // Calculate totals
  const totalTheoAdj = roundMinutesTo5(broderieTheoAdj + nettoyageApplique);
  const totalApplique = roundMinutesTo5(broderieAppliquee + nettoyageApplique);

  // Calculate equivalent total coefficient
  const coefTotalEquivalent = totalTheoAdj > 0
    ? Math.round((totalApplique / totalTheoAdj) * 100)
    : 100;

  return {
    broderieTheoAdj,
    nettoyageApplique,
    totalTheoAdj,
    broderieAppliquee,
    totalApplique,
    coefTotalEquivalent,
  };
}

/**
 * Extract theoretical minutes from scenario data
 * @param {Object} scen - Scenario object
 * @returns {Object} bruderieMin, nettoyageMin, totalMin
 */
function extractTheoMinutesFromScenario(scen) {
  if (!scen) return { broderieMin: 0, nettoyageMin: 0, totalMin: 0 };

  // Helper to convert hours to minutes
  const toMin = (h) => Math.max(0, Math.round(Number(h || 0) * 60));

  // Broderie time extraction
  const broderieMin = Number.isFinite(scen?.dureeBroderieMinutes)
    ? Math.max(0, Math.round(scen.dureeBroderieMinutes))
    : toMin(scen?.dureeBroderieHeures ?? scen?.dureeBroderieHeuresTheorique ?? scen?.broderieHeures ?? 0);

  // Nettoyage time extraction
  const nettoyageMin = Number.isFinite(scen?.dureeNettoyageMinutes)
    ? Math.max(0, Math.round(scen.dureeNettoyageMinutes))
    : toMin(scen?.dureeNettoyageHeures ?? scen?.nettoyageHeures ?? 0);

  // Total time extraction (fallback calculation)
  const totalMin = Number.isFinite(scen?.dureeTotaleMinutes)
    ? Math.max(0, Math.round(scen.dureeTotaleMinutes))
    : (Number.isFinite(scen?.dureeTotaleHeures) ? toMin(scen.dureeTotaleHeures) : broderieMin + nettoyageMin);

  // Ensure total is reasonable
  const safeTotal = Math.max(totalMin, broderieMin + nettoyageMin);

  return { broderieMin, nettoyageMin, totalMin: safeTotal };
}
