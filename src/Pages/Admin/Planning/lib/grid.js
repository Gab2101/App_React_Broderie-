import { parseISOAny } from "./parse";

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
 * Par défaut: début=floor, fin=ceil (élargit pour recouvrir la case).
 * Permet de passer startRound/endRound = 'floor' | 'ceil' si besoin.
 */
export function normalizeSlotForGrid(
  slot,
  { startRound = "floor", endRound = "ceil" } = {}
) {
  const s = parseISOAny(slot.debut);
  const e = parseISOAny(slot.fin);

  const sMs = s instanceof Date && !isNaN(s) ? s : new Date(slot.debut);
  const eMs = e instanceof Date && !isNaN(e) ? e : new Date(slot.fin);

  const startFn = startRound === "ceil" ? ceilToHourMs : floorToHourMs;
  const endFn = endRound === "floor" ? floorToHourMs : ceilToHourMs;

  const gs = startFn(sMs);
  const ge = endFn(eMs);

  if (!Number.isFinite(gs) || !Number.isFinite(ge)) {
    return { ...slot, gridStartMs: null, gridEndMs: null };
  }
  // (facultatif) éviter un end < start après arrondi
  const safeGe = Math.max(ge, gs);

  return { ...slot, gridStartMs: gs, gridEndMs: safeGe };
}
