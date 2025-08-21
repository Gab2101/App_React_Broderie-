// src/utils/slots.js
const TZ = 'Europe/Paris';
const DAY_START_H = 8;
const LUNCH_START_H = 12;
const LUNCH_END_H = 13;
const DAY_END_H = 17;

let HOLIDAYS = new Set();
let SKIP_NON_BUSINESS = false;

export function configureSlots({ skipNonBusiness = false, holidays = new Set() } = {}) {
  SKIP_NON_BUSINESS = !!skipNonBusiness;
  HOLIDAYS = holidays;
}

function tzParts(ms) {
  // Accepte ms (number) ou ISO string
  if (typeof ms === 'string') {
    const parsed = Date.parse(ms);
    if (!Number.isFinite(parsed)) throw new Error('[slots.tzParts] startMs string invalide: ' + ms);
    ms = parsed;
  }
  if (!Number.isFinite(ms)) throw new Error('[slots.tzParts] startMs non numérique: ' + ms);

  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) throw new Error('[slots.tzParts] Date invalide');

  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(d).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});


  return {
    Y: +parts.year, M: +parts.month, D: +parts.day,
    h: +parts.hour, m: +parts.minute, s: +parts.second
  };
}


function ymdKey(ms) {
  const {Y,M,D} = tzParts(ms);
  const pad = (n)=> String(n).padStart(2,'0');
  return `${Y}-${pad(M)}-${pad(D)}`;
}

function isBusinessDayLocal(ms) {
  const d = new Date(ms);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }).format(d);
  const isWeekend = (day === 'Sat' || day === 'Sun');
  if (isWeekend) return false;
  if (!SKIP_NON_BUSINESS) return true;
  return !HOLIDAYS.has(ymdKey(ms));
}

function atTZ({Y,M,D,h=0,m=0,s=0}) {
  const guess = Date.UTC(Y, M-1, D, h, m, s);
  const shown = tzParts(guess);
  if (shown.h !== h) return guess + (h - shown.h) * 3_600_000;
  return guess;
}

function floorToHourLocal(ms) {
  const p = tzParts(ms);
  return atTZ({...p, m:0, s:0});
}
function addOneHourLocal(ms) {
  const p = tzParts(ms);
  return atTZ({...p, h:p.h+1, m:0, s:0});
}

function isWorkHourLocal(ms) {
  const {h} = tzParts(ms);
  return (h >= DAY_START_H && h < LUNCH_START_H) || (h >= LUNCH_END_H && h < DAY_END_H);
}

function nextBusinessMorningLocal(ms) {
  let t = ms;
  do {
    const p = tzParts(t);
    const midnightNextUTC = Date.UTC(p.Y, p.M-1, p.D) + 24*3_600_000;
    const np = tzParts(midnightNextUTC);
    t = atTZ({...np, h:DAY_START_H, m:0, s:0});
  } while (!isBusinessDayLocal(t));
  return t;
}

function nextWorkStartLocal(ms) {
  let t = floorToHourLocal(ms);
  const p = tzParts(t);
  if (!isBusinessDayLocal(t)) t = nextBusinessMorningLocal(t);
  else if (p.h < DAY_START_H) t = atTZ({...p, h:DAY_START_H, m:0, s:0});
  else if (p.h === LUNCH_START_H) t = atTZ({...p, h:LUNCH_END_H, m:0, s:0});
  else if (p.h >= DAY_END_H) t = nextBusinessMorningLocal(t);

  if (!isWorkHourLocal(t)) {
    const pp = tzParts(t);
    if (pp.h < DAY_START_H) t = atTZ({...pp, h:DAY_START_H, m:0, s:0});
    else if (pp.h === LUNCH_START_H) t = atTZ({...pp, h:LUNCH_END_H, m:0, s:0});
    else if (pp.h >= DAY_END_H) t = nextBusinessMorningLocal(t);
  }
  return t;
}

function hourKey(ms) {
  const {Y,M,D,h} = tzParts(ms);
  const pad = (n)=> String(n).padStart(2,'0');
  return `${Y}-${pad(M)}-${pad(D)} ${pad(h)}:00`;
}

export function expandToHourSlots(startMs, durationMin) {
  // ⬇️ Normalise/valide les entrées
  const startMsNum = (typeof startMs === 'string') ? Date.parse(startMs) : startMs;
  if (!Number.isFinite(startMsNum)) {
    console.warn('[slots.expandToHourSlots] startMs invalide:', startMs);
    return [];
  }

  const durationMinNum = Number(durationMin);
  const remainingSlotsInit = Math.ceil((Number.isFinite(durationMinNum) ? durationMinNum : 0) / 60);

  let remainingSlots = Math.max(0, remainingSlotsInit);
  let slotStart = floorToHourLocal(startMsNum);
  slotStart = isWorkHourLocal(slotStart) ? slotStart : nextWorkStartLocal(slotStart);

  const slots = [];
  while (remainingSlots > 0) {
    if (!isBusinessDayLocal(slotStart) || !isWorkHourLocal(slotStart)) {
      slotStart = nextWorkStartLocal(slotStart);
      continue;
    }
    slots.push({ key: hourKey(slotStart), startMs: slotStart });
    slotStart = addOneHourLocal(slotStart);
    remainingSlots -= 1;
  }
  return slots;
}
