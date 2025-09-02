// src/utils/time.js

/** =========================
 *  Normalisation des dates
 *  ========================= */
export const toDate = (v) => {
  if (v instanceof Date) return new Date(v.getTime());
  if (typeof v === "number") return new Date(v); // timestamp ms
  if (typeof v === "string") {
    const s = v.trim().replace(" ", "T"); // supporte "YYYY-MM-DD HH:mm:ss"
    return new Date(s);
  }
  return new Date(); // fallback
};

// Helpers d’addition sûrs (évite les conversions implicites en number)
export function addMs(dateLike, ms) {
  const d = toDate(dateLike);
  return new Date(d.getTime() + (Number(ms) || 0));
}
export function addHours(dateLike, hours) {
  return addMs(dateLike, (Number(hours) || 0) * 60 * 60 * 1000);
}

/** =========================
 *  Constantes & options
 *  ========================= */
export const ONE_HOUR_MS = 60 * 60 * 1000;

export const WORKDAY = {
  start: 8,       // début journée
  lunchStart: 12, // début pause
  lunchEnd: 13,   // fin pause
  end: 16,        // fin journée (exclu)
};

/** =========================
 *  Arrondis à l’heure pleine
 *  ========================= */
/** Renvoie une **Date** alignée sur l’heure pleine inférieure. */
export function floorToHour(dateLike) {
  const d = toDate(dateLike);
  d.setMinutes(0, 0, 0);
  return d;
}
/** Renvoie un **timestamp ms** aligné sur l’heure pleine inférieure. */
export function floorToHourMs(dateLike) {
  return floorToHour(dateLike).getTime();
}

/** Renvoie une **Date** alignée sur l’heure pleine supérieure.
 *  Si déjà sur l’heure pile, renvoie la même heure.
 */
export function ceilToHour(dateLike) {
  const d = toDate(dateLike);
  if (d.getMinutes() || d.getSeconds() || d.getMilliseconds()) {
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
  } else {
    d.setSeconds(0, 0);
  }
  return d;
}
/** Renvoie un **timestamp ms** aligné sur l’heure pleine supérieure. */
export function ceilToHourMs(dateLike) {
  return ceilToHour(dateLike).getTime();
}

/** Alias explicite pour les usages métier : prochaine heure pleine */
export const ceilToNextHour = ceilToHour;

/** =========================
 *  Jours ouvrés / fériés
 *  ========================= */
function ymdLocal(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Sauter les week-ends/jours fériés ?
 *  holidays: Set(['2025-08-15', '2025-12-25']) au format YYYY-MM-DD (local)
 */
export function isBusinessDay(input, holidays = new Set()) {
  const d = toDate(input);
  const day = d.getDay(); // 0=dim,6=sam
  const ymd = ymdLocal(d); // ⚠️ local (pas toISOString/UTC)
  return day !== 0 && day !== 6 && !holidays.has(ymd);
}

/** Clamp une date dans les heures ouvrées du jour courant (sans changer de jour)
 *  Si on est:
 *   - avant 08:00 → 08:00
 *   - entre 12:00-13:00 → 13:00
 *   - après >=17:00 → 16:00 (marque la fin de journée)
 */
function clampToWorkBoundsSameDay(input) {
  const c = toDate(input);
  const h = c.getHours();
  if (h < WORKDAY.start) {
    c.setHours(WORKDAY.start, 0, 0, 0);
  } else if (
    h === WORKDAY.lunchStart &&
    (c.getMinutes() || c.getSeconds() || c.getMilliseconds())
  ) {
    // 12:xx → bascule 13:00
    c.setHours(WORKDAY.lunchEnd, 0, 0, 0);
  } else if (h >= WORKDAY.end) {
    c.setHours(WORKDAY.end, 0, 0, 0);
  }
  return c;
}

/** Passe à 08:00 du prochain jour ouvré (par rapport à d) */
function nextBusinessMorning(input, holidays) {
  const c = toDate(input);
  // Passer au lendemain matin
  c.setDate(c.getDate() + 1);
  c.setHours(WORKDAY.start, 0, 0, 0);
  // Boucler jusqu’au prochain jour ouvré
  while (!isBusinessDay(c, holidays)) {
    c.setDate(c.getDate() + 1);
  }
  return c;
}

/** Renvoie true si l'heure est strictement dans une tranche travaillée (8–12 ou 13–17) */
export function isWorkHour(input) {
  const d = toDate(input);
  const h = d.getHours();
  return (
    (h >= WORKDAY.start && h < WORKDAY.lunchStart) ||
    (h >= WORKDAY.lunchEnd && h < WORKDAY.end)
  );
}

/** =========================
 *  Logique horaire ouvrée
 *  ========================= */
/** Arrondit/avance à la prochaine heure ouvrée valide.
 *  - si minutes/secondes/ms != 0 → passe à l’heure suivante
 *  - si < 08:00 → 08:00
 *  - si dans 12–13 → 13:00
 *  - si >=16:00 → demain 08:00 (prochain jour ouvré si demandé)
 *  - option skipNonBusiness/holidays
 */
export function nextWorkStart(dateLike, { skipNonBusiness = false, holidays = new Set() } = {}) {
  let cur = toDate(dateLike);

  // Si on est sur un jour non ouvré et qu’on veut les éviter → demain matin ouvré
  if (skipNonBusiness && !isBusinessDay(cur, holidays)) {
    cur = nextBusinessMorning(cur, holidays);
  }

  // Si pas pile sur une heure → arrondir à l’heure suivante
  if (cur.getMinutes() || cur.getSeconds() || cur.getMilliseconds()) {
    cur = ceilToHour(cur);
  }

  // Appliquer les bornes de la journée (midi/nuit)
  cur = clampToWorkBoundsSameDay(cur);

  // Si on est pile à/au-delà de la fin (17:00) → demain 08:00 (ouvré si demandé)
  if (cur.getHours() >= WORKDAY.end) {
    cur = skipNonBusiness ? nextBusinessMorning(cur, holidays) : toDate(cur);
    if (!skipNonBusiness) {
      cur.setDate(cur.getDate() + 1);
      cur.setHours(WORKDAY.start, 0, 0, 0);
    }
  }

  // Si on est dans une tranche non travaillée (ex: 12 pile), corriger
  if (!isWorkHour(cur)) {
    if (cur.getHours() === WORKDAY.lunchStart) {
      cur.setHours(WORKDAY.lunchEnd, 0, 0, 0);
    } else if (cur.getHours() < WORKDAY.start) {
      cur.setHours(WORKDAY.start, 0, 0, 0);
    } else if (cur.getHours() >= WORKDAY.end) {
      cur = skipNonBusiness ? nextBusinessMorning(cur, holidays) : toDate(cur);
      if (!skipNonBusiness) {
        cur.setDate(cur.getDate() + 1);
        cur.setHours(WORKDAY.start, 0, 0, 0);
      }
    }
  }

  // Après ajustements, si on retombe sur un non-business day
  if (skipNonBusiness && !isBusinessDay(cur, holidays)) {
    cur = nextBusinessMorning(cur, holidays);
  }

  return cur;
}

/** Ajoute N heures ouvrées (entier ; arrondi à l’heure sup appliqué en amont en général)
 *  – saute 12–13
 *  – coupe à 17:00 et reprend à 08:00
 *  – option week-ends/jours fériés
 */
export function addWorkingHours(start, hours, { skipNonBusiness = false, holidays = new Set() } = {}) {
  let cur = nextWorkStart(start, { skipNonBusiness, holidays });
  let remaining = Math.max(0, Math.ceil(Number(hours) || 0));

  while (remaining > 0) {
    // Si on tombe hors tranche pour une raison quelconque, se réaligner
    if (!isWorkHour(cur)) {
      cur = nextWorkStart(cur, { skipNonBusiness, holidays });
    }

    const h = cur.getHours();
    // Borne de fin de la plage en cours (12 ou 17)
    const boundary = h < WORKDAY.lunchStart ? WORKDAY.lunchStart : WORKDAY.end;
    const available = boundary - h;
    const consume = Math.min(available, remaining);

    // Consommer les heures disponibles dans la tranche
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
  const d = toDate(dateStart);
  const end = addMs(d, ONE_HOUR_MS);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const h1 = String(d.getHours()).padStart(2, "0");
  const h2 = String(end.getHours()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${h1} h - ${h2} h`;
}

/** Prochaine heure pleine à partir de "maintenant", respectant les règles ouvrées */
export function getNextFullHour(minHour = WORKDAY.start, opts = {}) {
  const { skipNonBusiness = false, holidays = new Set() } = opts;
  const base = toDate(new Date());
  const nextHour = ceilToHour(base);
  let res = nextWorkStart(nextHour, { skipNonBusiness, holidays });

  if (res.getHours() < minHour && isBusinessDay(res, holidays)) {
    res.setHours(minHour, 0, 0, 0);
    if (!isWorkHour(res)) {
      res = nextWorkStart(res, { skipNonBusiness, holidays });
    }
  }
  return res;
}


/** 1.23 → "1h 14min" */
export function convertDecimalToTime(decimal) {
  const totalMinutes = Math.round((Number(decimal) || 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}


/** 1.75 → "1h 45min" */
export function convertHoursToHHMM(hoursDecimal) {
  const totalMinutes = Math.round((Number(hoursDecimal) || 0) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

/** Compat ascendante : alias vers addWorkingHours */
export function ajusterHeureFin(debut, dureeHeures, opts = {}) {
  return addWorkingHours(debut, dureeHeures, opts);
}

/** Exports complémentaires provenant de ./slots si tu les utilises déjà */
export { configureSlots, expandToHourSlots } from "./slots";
