// src/Pages/Admin/Planning/lib/workingHours.js
import { isBusinessDay, isWorkHour } from "../../../../utils/time";
import { parseISOAny } from "./parse";

// Arrondi à l'heure supérieure en local (Europe/Paris côté navigateur)
function ceilToHourLocal(dLike) {
  const d = new Date(dLike);
  if (d.getMinutes() || d.getSeconds() || d.getMilliseconds()) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMilliseconds(0);
  }
  return d;
}

export function workingHoursBetween(
  startISO,
  endISO,
  { skipNonBusiness = true, holidays = new Set() } = {}
) {
  const start = parseISOAny(startISO);
  const end = parseISOAny(endISO);
  if (!(start < end)) return 0;

  // On part de la prochaine heure pleine locale (Paris)
  const cur = ceilToHourLocal(start);
  let count = 0;

  while (cur < end) {
    // Filtre jours ouvrés (si demandé) + heure de travail (08–12 / 13–16 via isWorkHour)
    if ((!skipNonBusiness || isBusinessDay(cur, holidays)) && isWorkHour(cur)) {
      count += 1;
    }
    // Avance d'une heure pleine locale
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }

  return count;
}
