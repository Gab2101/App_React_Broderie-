// src/Pages/Admin/Commandes/utils/timeRealtime.js
import { addWorkingHours } from "../../../../utils/time";

export const roundMinutesTo5 = (m) => Math.max(0, Math.round(m / 5) * 5);

export const clampPercentToStep5 = (p) => {
  const clamped = Math.min(500, Math.max(50, p));
  return clamped - (clamped % 5);
};

export const computeProvisionalEnd = (debut, minutesAppliquees) => {
  if (!debut || !minutesAppliquees) return null;
  return addWorkingHours(debut, minutesAppliquees / 60);
};
