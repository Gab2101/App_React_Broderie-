// src/Pages/Admin/Commandes/utils/workhours.js

// --- Config journée ouvrée Paris ---
export const DEFAULT_WORKDAY = {
  start: 7 * 60,       // 07:00
  lunchStart: 12 * 60, // 12:00
  lunchEnd: 13 * 60,   // 13:00 (pause 1h)
  end: 16 * 60         // 16:00 (4 PM) → +8h utiles / jour = 9h total
};

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const setHM = (d, minutes) => {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};

export function snapToNextWorkStart(date, cfg = DEFAULT_WORKDAY) {
  let d = new Date(date);
  // weekend -> lundi 08:00
  while (isWeekend(d)) {
    d.setDate(d.getDate() + 1);
    d = setHM(d, cfg.start);
  }
  const minutes = d.getHours() * 60 + d.getMinutes();

  if (minutes < cfg.start) return setHM(d, cfg.start);
  if (minutes >= cfg.end) {
    const nxt = new Date(d);
    nxt.setDate(nxt.getDate() + 1);
    return snapToNextWorkStart(setHM(nxt, cfg.start), cfg);
  }
  // si dans la pause, snap à 13:30
  if (minutes >= cfg.lunchStart && minutes < cfg.lunchEnd) return setHM(d, cfg.lunchEnd);
  return d;
}

export function addMinutesWithinWorkHours(startDate, minutesToAdd, cfg = DEFAULT_WORKDAY) {
  let d = snapToNextWorkStart(startDate, cfg);
  let remaining = minutesToAdd;

  while (remaining > 0) {
    // borne début/fin du créneau courant (AM ou PM)
    const curMins = d.getHours() * 60 + d.getMinutes();
    const slotEnd = curMins < cfg.lunchStart ? cfg.lunchStart
                   : (curMins < cfg.lunchEnd ? cfg.lunchEnd
                   : cfg.end);
    const canDo = Math.max(0, slotEnd - curMins);

    if (canDo > 0) {
      const use = Math.min(canDo, remaining);
      d = new Date(d.getTime() + use * 60000);
      remaining -= use;
      if (remaining === 0) break;
    }

    // avancer au prochain créneau
    const after = new Date(d);
    const minutes = after.getHours() * 60 + after.getMinutes();
    if (minutes >= cfg.lunchStart && minutes < cfg.lunchEnd) {
      d = setHM(after, cfg.lunchEnd);
    } else if (minutes >= cfg.end) {
      const nxt = new Date(after);
      do { nxt.setDate(nxt.getDate() + 1); } while (isWeekend(nxt));
      d = setHM(nxt, cfg.start);
    } else if (minutes < cfg.lunchStart) {
      d = setHM(after, cfg.lunchEnd); // bascule PM après la pause
    } else {
      // entre lunchEnd et end : rien, continuera boucle
    }
  }
  return { end: d, actualMinutes: minutesToAdd };
}

// Legacy compatibility functions
export function parseLocalDatetime(str) {
  if (!str) return new Date();
  const [d, t = '00:00'] = str.split('T');
  const [Y, M, D] = d.split('-').map(Number);
  const [h, m] = t.split(':').map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, h || 0, m || 0);
}

export function toUTCISOString(date) {
  return new Date(date.getTime()).toISOString();
}

export function parisAt(dateLike, hour, minute = 0) {
  const base = new Date(dateLike);
  return setHM(base, hour * 60 + minute);
}

export function formatTimeParis(date) {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function roundUpToNextHourParis(date) {
  const d = new Date(date);
  const h = d.getHours();
  const m = d.getMinutes();
  if (m > 0) {
    d.setHours(h + 1, 0, 0, 0);
  } else {
    d.setHours(h, 0, 0, 0);
  }
  return d;
}

export function dayBoundsParisUTC(dateLike) {
  const d = new Date(dateLike);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { startUTC: start, endUTC: end };
}
