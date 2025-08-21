// src/utils/time.js

/** =========================
 *  Constantes & options
 *  ========================= */
export const ONE_HOUR_MS = 60 * 60 * 1000;

export const WORKDAY = {
  start: 8,       // début journée
  lunchStart: 12, // début pause
  lunchEnd: 13,   // fin pause
  end: 17,        // fin journée (exclu)
};

/** Sauter les week-ends/jours fériés ?
 *  holidays: Set(['2025-08-15', '2025-12-25']) au format YYYY-MM-DD
 */
export function isBusinessDay(d, holidays = new Set()) {
  const day = d.getDay(); // 0=dim,6=sam
  const ymd = d.toISOString().slice(0, 10);
  return day !== 0 && day !== 6 && !holidays.has(ymd);
}

/** Clamp une date dans les heures ouvrées du jour courant (sans changer de jour)
 *  Si on est:
 *   - avant 08:00 → 08:00
 *   - entre 12:00-13:00 → 13:00
 *   - après >=17:00 → 17:00 (marque la fin de journée)
 */
function clampToWorkBoundsSameDay(d) {
  const c = new Date(d);
  const h = c.getHours();
  if (h < WORKDAY.start) c.setHours(WORKDAY.start, 0, 0, 0);
  else if (h === WORKDAY.lunchStart && (c.getMinutes() || c.getSeconds() || c.getMilliseconds())) {
    // 12:xx → bascule 13:00
    c.setHours(WORKDAY.lunchEnd, 0, 0, 0);
  } else if (h >= WORKDAY.end) c.setHours(WORKDAY.end, 0, 0, 0);
  return c;
}

/** Renvoie true si l'heure est strictement dans une tranche travaillée (8–12 ou 13–17) */
export function isWorkHour(d) {
  const h = d.getHours();
  return (h >= WORKDAY.start && h < WORKDAY.lunchStart) ||
         (h >= WORKDAY.lunchEnd && h < WORKDAY.end);
}

/** Passe à 08:00 du prochain jour ouvré (si week-ends/feriés désactivent le jour courant) */
function nextBusinessMorning(d, holidays) {
  const c = new Date(d);
  c.setHours(WORKDAY.start, 0, 0, 0);
  do {
    c.setDate(c.getDate() + 1);
  } while (!isBusinessDay(c, holidays));
  return c;
}

/** Arrondit/avance à la prochaine heure ouvrée valide.
 *  - si minutes/secondes/ms != 0 → passe à l’heure suivante
 *  - si < 08:00 → 08:00
 *  - si dans 12–13 → 13:00
 *  - si >=17:00 → demain 08:00 (prochain jour ouvré)
 *  - option skipWeekends/holidays
 */
export function nextWorkStart(dateLike, { skipNonBusiness = false, holidays = new Set() } = {}) {
  let cur = new Date(dateLike);

  // Si on skippe week-ends/feriés et que le jour n'est pas ouvré → passer au prochain jour ouvré 08:00
  if (skipNonBusiness && !isBusinessDay(cur, holidays)) {
    cur = nextBusinessMorning(cur, holidays);
  }

  // Arrondir à l'heure suivante si on n'est pas déjà pile
  if (cur.getMinutes() || cur.getSeconds() || cur.getMilliseconds()) {
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }

  // Clamp dans le jour courant
  cur = clampToWorkBoundsSameDay(cur);

  // Si on est pile à 17:00 → passer au lendemain 08:00 (jour ouvré si option activée)
  if (cur.getHours() >= WORKDAY.end) {
    cur = skipNonBusiness ? nextBusinessMorning(cur, holidays)
                          : cur.setDate(cur.getDate() + 1);
                            cur.setHours(WORKDAY.start, 0, 0, 0);

  }

  // Si on retombe dans un non-business day après les ajustements
  if (skipNonBusiness && !isBusinessDay(cur, holidays)) {
    cur = nextBusinessMorning(cur, holidays);
  }

  // Si on est dans une tranche non travaillée (ex: 12–13), renvoyer le prochain slot (13:00)
  if (!isWorkHour(cur)) {
    if (cur.getHours() === WORKDAY.lunchStart) cur.setHours(WORKDAY.lunchEnd, 0, 0, 0);
    else if (cur.getHours() < WORKDAY.start) cur.setHours(WORKDAY.start, 0, 0, 0);
    else if (cur.getHours() >= WORKDAY.end) {
      cur = skipNonBusiness ? nextBusinessMorning(cur, holidays)
                            : new Date(cur.setDate(cur.getDate() + 1)) && new Date(cur.setHours(WORKDAY.start, 0, 0, 0));
    }
  }

  return cur;
}

/** Ajoute N heures ouvrées (entier arrondi à l’heure sup déjà appliqué en amont en général)
 *  – saute 12–13
 *  – coupe à 17:00 et reprend à 08:00
 *  – option week-ends/jours fériés
 */
export function addWorkingHours(start, hours, { skipNonBusiness = false, holidays = new Set() } = {}) {
  let cur = nextWorkStart(start, { skipNonBusiness, holidays });
  let remaining = Math.max(0, Math.ceil(Number(hours) || 0));

  while (remaining > 0) {
    if (!isWorkHour(cur)) {
      cur = nextWorkStart(cur, { skipNonBusiness, holidays });
    }
    const h = cur.getHours();
    // Borne de fin de la plage en cours (12 ou 17)
    const boundary = h < WORKDAY.lunchStart ? WORKDAY.lunchStart : WORKDAY.end;
    const available = boundary - h;
    const consume = Math.min(available, remaining);

    cur.setHours(h + consume, 0, 0, 0);
    remaining -= consume;
    if (remaining === 0) break;

    // Sauter midi
    if (cur.getHours() === WORKDAY.lunchStart) {
      cur.setHours(WORKDAY.lunchEnd, 0, 0, 0);
    }
    // Sauter la nuit
    if (cur.getHours() >= WORKDAY.end) {
      if (skipNonBusiness) {
        cur = nextBusinessMorning(cur, holidays);
      } else {
        cur.setDate(cur.getDate() + 1);
        cur.setHours(WORKDAY.start, 0, 0, 0);
      }
    }
  }

  return cur;
}

/** Format "dd/mm/yyyy HH h - HH h" sur 1h */
export function formatHourRangeFR(dateStart) {
  const d = new Date(dateStart);
  const end = new Date(+d + ONE_HOUR_MS);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const h1 = String(d.getHours()).padStart(2, "0");
  const h2 = String(end.getHours()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${h1} h - ${h2} h`;
}

/** ======== Tes helpers conservés / harmonisés ======== */

/** Prochaine heure pleine, minimum minHour (ex: 8) */
export function getNextFullHour(minHour = WORKDAY.start, opts = {}) {
  // Utilise notre moteur pour garantir les règles ouvrées
  return nextWorkStart(new Date(), opts);
}

/** 1.23 → "1h 14min" */
export function convertDecimalToTime(decimal) {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

/** 1.75 → "1h 45min" */
export function convertHoursToHHMM(hoursDecimal) {
  const totalMinutes = Math.round((Number(hoursDecimal) || 0) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

/** Ancienne logique "ajusterHeureFin" → remplace par addWorkingHours
 *  Gardée pour compat descendante, mais redirigée.
 */
export function ajusterHeureFin(debut, dureeHeures, opts = {}) {
  return addWorkingHours(debut, dureeHeures, opts);
}
export { configureSlots, expandToHourSlots } from './slots';
