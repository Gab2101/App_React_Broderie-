// src/Pages/Admin/Commandes/utils/timeRealtime.js
import { addMinutesWithinWorkHours,snapToNextWorkStart,DEFAULT_WORKDAY,} from "./workhours";
export const roundMinutesTo5 = (m) => Math.max(0, Math.round(m / 5) * 5);

export const clampPercentToStep5 = (p) => {
  const clamped = Math.min(500, Math.max(50, p));
  return clamped - (clamped % 5);
};

export const computeProvisionalEnd = (debut, minutesAppliquees) => {
  const minutes = Number(minutesAppliquees);
  const start = debut instanceof Date ? debut : (debut ? new Date(debut) : null);
  if (!start || !Number.isFinite(minutes) || minutes <= 0) return null;
  // Aligne le départ sur une fenêtre ouvrée Paris (gère 12–13, 16:00, week-ends)
  const aligned = snapToNextWorkStart(start, DEFAULT_WORKDAY);
  // Ajoute en respectant 07–12 / 13–16 et coupure multi-jours
  const { end } = addMinutesWithinWorkHours(aligned, minutes, DEFAULT_WORKDAY);
  return end;
}
