import { isBusinessDay, isWorkHour } from "../../../../utils/time";
import { parseISOAny } from "./parse";

export function workingHoursBetween(startISO, endISO, { skipNonBusiness = true, holidays = new Set() } = {}) {
  const start = parseISOAny(startISO);
  const end   = parseISOAny(endISO);
  if (!(start < end)) return 0;

  const cur = new Date(start);
  if (cur.getMinutes() || cur.getSeconds() || cur.getMilliseconds()) {
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }
  let count = 0;
  while (cur < end) {
    if ((!skipNonBusiness || isBusinessDay(cur, holidays)) && isWorkHour(cur)) count += 1;
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }
  return count;
}
