// src/Pages/Admin/Commandes/utils/timeRealtime.js
import { addWorkingHours } from "../../../../utils/time";

/**
 * Arrondit une valeur en minutes ou une Date aux 5 minutes les plus proches
 * @param {number|Date} input - Minutes (number) ou Date object
 * @returns {number|Date} - Même type que l'input, arrondi aux 5 minutes
 */
export const roundMinutesTo5 = (input) => {
  if (input instanceof Date) {
    const date = new Date(input);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    date.setMinutes(roundedMinutes, 0, 0);
    return date;
  }
  // Si c'est un nombre (minutes)
  return Math.max(0, Math.round(input / 5) * 5);
};

export const clampPercentToStep5 = (p) => {
  const clamped = Math.min(500, Math.max(50, p));
  return clamped - (clamped % 5);
};

export const computeProvisionalEnd = (debut, minutesAppliquees) => {
  if (!debut || !minutesAppliquees) return null;
  return addWorkingHours(debut, minutesAppliquees / 60);
};
