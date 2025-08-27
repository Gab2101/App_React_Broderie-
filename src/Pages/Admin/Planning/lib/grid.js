// src/Pages/Admin/Planning/lib/grid.js
import { parseISOAny } from "./parse";

export function floorToHourMs(d) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x.getTime();
}

export function ceilToHourMs(d) {
  const x = new Date(d);
  if (x.getMinutes() || x.getSeconds() || x.getMilliseconds()) {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  } else {
    x.setMinutes(0, 0, 0);
  }
  return x.getTime();
}

export function normalizeSlotForGrid(slot) {
  const gs = floorToHourMs(parseISOAny(slot.debut));
  const ge = ceilToHourMs(parseISOAny(slot.fin));
  return { ...slot, gridStartMs: gs, gridEndMs: ge };
}
