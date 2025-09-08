// src/Pages/Admin/Planning/lib/grid.js
import { parseISOAny } from "./parse";

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function floorToHourMs(d) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x.getTime();
}

export function ceilToHourMs(d) {
  const x = new Date(d);
  if (x.getMinutes() || x.getSeconds() || x.getMilliseconds()) {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  } else {
    x.setMinutes(0, 0, 0);
  }
  return x.getTime();
}

/**
 * Aligne un slot sur des heures pleines pour la GRILLE.
 * Par défaut: début = floor, fin = ceil (recouvre la case).
 * startRound/endRound ∈ 'floor' | 'ceil'
 */
export function normalizeSlotForGrid(
  slot,
  { startRound = "floor", endRound = "ceil" } = {}
) {
  const sDate = parseISOAny(slot.debut);
  const eDate = parseISOAny(slot.fin);

  if (!isValidDate(sDate) || !isValidDate(eDate)) {
    return { ...slot, gridStartMs: null, gridEndMs: null };
  }

  const startFn = startRound === "ceil" ? ceilToHourMs : floorToHourMs;
  const endFn   = endRound   === "floor" ? floorToHourMs : ceilToHourMs;

  const gs = startFn(sDate);
  const ge = endFn(eDate);

  if (!Number.isFinite(gs) || !Number.isFinite(ge)) {
    return { ...slot, gridStartMs: null, gridEndMs: null };
  }

  // Sécurité : ne jamais retourner end < start après arrondi
  const safeGe = Math.max(ge, gs);

  return { ...slot, gridStartMs: gs, gridEndMs: safeGe };
}
