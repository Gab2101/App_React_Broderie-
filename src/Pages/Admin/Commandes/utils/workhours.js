// src/Pages/Admin/Commandes/utils/workhours.js
// Règles simples et robustes (8h–16h, skip week-ends)

export const DEFAULT_WORKDAY = {
  startHour: 8,
  endHour: 16,
  weekend: [0, 6], // 0=dim, 6=sam
};

export function parseLocalDatetime(str) {
  // "YYYY-MM-DDTHH:mm" -> Date locale
  if (!str) return new Date();
  const [d, t = "00:00"] = str.split("T");
  const [Y, M, D] = d.split("-").map(Number);
  const [h, m] = t.split(":").map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0, 0);
}

export function toUTCISOString(date) {
  return new Date(date.getTime()).toISOString();
}

export function isWeekend(date, cfg = DEFAULT_WORKDAY) {
  return cfg.weekend.includes(date.getDay());
}

export function atTime(date, hour, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Aligne une date sur la prochaine fenêtre ouvrée (08:00–16:00)
 * - si week-end -> passe à lundi 08:00
 * - si avant 08:00 -> même jour 08:00
 * - si après 16:00 -> jour suivant ouvré 08:00
 */
export function snapToNextWorkStart(date, cfg = DEFAULT_WORKDAY) {
  let d = new Date(date);
  // si week-end -> lundi 08:00
  while (isWeekend(d, cfg)) {
    d.setDate(d.getDate() + 1);
    d = atTime(d, cfg.startHour, 0);
  }
  const start = atTime(d, cfg.startHour);
  const end = atTime(d, cfg.endHour);

  if (d < start) return start;
  if (d >= end) {
    // lendemain ouvré 08:00
    let n = new Date(d);
    do {
      n.setDate(n.getDate() + 1);
    } while (isWeekend(n, cfg));
    return atTime(n, cfg.startHour);
  }
  return d;
}

/**
 * Ajoute des minutes en respectant les heures ouvrées (peut déborder sur plusieurs jours)
 * Retourne { end }
 */
export function addMinutesWithinWorkHours(start, minutes, cfg = DEFAULT_WORKDAY) {
  let remaining = Math.max(0, Number(minutes) || 0);
  let cursor = snapToNextWorkStart(start, cfg);

  while (remaining > 0) {
    const dayEnd = atTime(cursor, cfg.endHour);
    const slice = Math.min(remaining, Math.max(0, (dayEnd - cursor) / 60000));
    if (slice <= 0) {
      // passe au prochain jour ouvré 08:00
      let n = new Date(cursor);
      do {
        n.setDate(n.getDate() + 1);
      } while (isWeekend(n, cfg));
      cursor = atTime(n, cfg.startHour);
      continue;
    }
    // consomme le créneau
    cursor = new Date(cursor.getTime() + slice * 60000);
    remaining -= slice;
    if (remaining > 0) {
      // saute au prochain jour 08:00
      let n = new Date(cursor);
      do {
        n.setDate(n.getDate() + 1);
      } while (isWeekend(n, cfg));
      cursor = atTime(n, cfg.startHour);
    }
  }
  return { end: cursor };
}
