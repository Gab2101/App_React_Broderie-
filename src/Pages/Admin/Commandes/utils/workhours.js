// src/Pages/Admin/Commandes/utils/workhours.js

// --- Config journée ouvrée Paris ---
export const DEFAULT_WORKDAY = {
  startHour: 7,
  lunchStart: 12,
  lunchEnd: 13,
  endHour: 16,
  weekend: [0, 6], // 0=dim, 6=sam
};
const PARIS_TZ = 'Europe/Paris';

// "YYYY-MM-DDTHH:mm" -> Date à partir d'un input HTML (local), on convertit en instant.
export function parseLocalDatetime(str) {
  if (!str) return new Date();
  const [d, t = '00:00'] = str.split('T');
  const [Y, M, D] = d.split('-').map(Number);
  const [h, m] = t.split(':').map(Number);
  // Construire l’instant correspondant à (Y-M-D h:m) en Europe/Paris
  return parisWallTimeToDate(Y, M, D, h || 0, m || 0);
}

// Stockage DB (timestamptz UTC)
export function toUTCISOString(date) {
  return new Date(date.getTime()).toISOString();
}

export function isWeekend(date, cfg = DEFAULT_WORKDAY) {
  return cfg.weekend.includes(date.getDay());
}

// ===== Helpers Paris (évite dépendance au TZ machine) =====

// Extrait Y/M/D de la date "vue depuis Paris"
function getParisYMD(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  return { Y: Number(parts.year), M: Number(parts.month), D: Number(parts.day) };
}

// Convertit un "mur" Paris (Y,M,D h:m) en Date (instant UTC correct) sans lib tierce.
// Algorithme : essaie UTC puis ajuste jusqu’à ce que l’heure Paris affichée == h:m (gère DST).
function parisWallTimeToDate(Y, M, D, h = 0, m = 0) {
  let d = new Date(Date.UTC(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS_TZ, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const pad = (n) => String(n).padStart(2, '0');
  const target = `${pad(h)}:${pad(m)}`;

  // Ajuste en pas de 60 min (DST Europe ±60)
  for (let i = 0; i < 3; i++) {
    const shown = fmt.format(d); // "HH:MM"
    if (shown === target) return d;
    // calcule delta minutes (ex: shown=11:00, target=12:00 -> +60)
    const [sh, sm] = shown.split(':').map(Number);
    const delta = (h * 60 + m) - (sh * 60 + sm);
    d = new Date(d.getTime() + delta * 60000);
  }
  return d; // fallback : très proche
}

// Renvoie une Date correspondant à "même jour Paris" à HH:MM (mur Paris)
export function parisAt(dateLike, hour, minute = 0) {
  const base = new Date(dateLike);
  const { Y, M, D } = getParisYMD(base);
  return parisWallTimeToDate(Y, M, D, hour, minute);
}

// Affichage heure locale Paris (pour UI)
export function formatTimeParis(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TZ, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

// Arrondi à l’heure supérieure sur l’axe Paris (pour “En cours”/“Terminée”)
export function roundUpToNextHourParis(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  let h = Number(parts.hour), m = Number(parts.minute);
  const Y = Number(parts.year), M = Number(parts.month), D = Number(parts.day);
  if (m > 0) h += 1;
  return parisWallTimeToDate(Y, M, D, h % 24, 0);
}

// Bornes jour (calcul en Paris), retournées en UTC pour requêtes DB
export function dayBoundsParisUTC(dateLike) {
  const d = new Date(dateLike);
  const { Y, M, D } = getParisYMD(d);
  const startUTC = parisWallTimeToDate(Y, M, D, 0, 0);
  const endUTC = parisWallTimeToDate(Y, M, D, 23, 59, 59);
  return { startUTC, endUTC };
}

// ===== Planning : 07:00–12:00 / 13:00–16:00 =====

// Aligne sur prochaine fenêtre ouvrée (gère week-end + pause)
export function snapToNextWorkStart(date, cfg = DEFAULT_WORKDAY) {
  let d = new Date(date);

  // saute week-ends vers lundi 07:00
  while (isWeekend(d, cfg)) {
    d = parisAt(new Date(d.setDate(d.getDate() + 1)), cfg.startHour, 0);
  }

  const start = parisAt(d, cfg.startHour, 0);
  const lunchStart = parisAt(d, cfg.lunchStart, 0);
  const lunchEnd = parisAt(d, cfg.lunchEnd, 0);
  const end = parisAt(d, cfg.endHour, 0);

  if (d < start) return start;
  if (d >= end) {
    // prochain jour ouvré 07:00
    let n = new Date(d);
    do { n.setDate(n.getDate() + 1); } while (isWeekend(n, cfg));
    return parisAt(n, cfg.startHour, 0);
  }
  // pendant la pause -> renvoie 13:00
  if (d >= lunchStart && d < lunchEnd) return lunchEnd;

  return d;
}

// Ajoute des minutes en respectant 07–12 / 13–16 (multi-jours)
export function addMinutesWithinWorkHours(start, minutes, cfg = DEFAULT_WORKDAY) {
  let remaining = Math.max(0, Number(minutes) || 0);
  let cursor = snapToNextWorkStart(start, cfg);

  while (remaining > 0) {
    const lunchStart = parisAt(cursor, cfg.lunchStart, 0);
    const lunchEnd = parisAt(cursor, cfg.lunchEnd, 0);
    const dayEnd = parisAt(cursor, cfg.endHour, 0);

    // Détermine la fin du créneau courant (avant pause ou fin de journée)
    const nextBreak = (cursor < lunchStart) ? lunchStart
                    : (cursor < lunchEnd) ? lunchEnd
                    : dayEnd;

    const slice = Math.min(remaining, Math.max(0, (nextBreak - cursor) / 60000));

    if (slice <= 0) {
      // Avance à reprise (pause) ou au prochain jour 07:00
      if (cursor >= lunchStart && cursor < lunchEnd) {
        cursor = lunchEnd;
      } else {
        // prochain jour ouvré 07:00
        let n = new Date(cursor);
        do { n.setDate(n.getDate() + 1); } while (isWeekend(n, cfg));
        cursor = parisAt(n, cfg.startHour, 0);
      }
      continue;
    }

    // Consomme le créneau
    cursor = new Date(cursor.getTime() + slice * 60000);
    remaining -= slice;

    if (remaining > 0) {
      // Si on a atteint une coupure, saute à la prochaine fenêtre
      if (cursor >= lunchStart && cursor < lunchEnd) {
        cursor = lunchEnd;
      } else if (cursor >= dayEnd) {
        let n = new Date(cursor);
        do { n.setDate(n.getDate() + 1); } while (isWeekend(n, cfg));
        cursor = parisAt(n, cfg.startHour, 0);
      }
    }
  }
  return { end: cursor };
}
