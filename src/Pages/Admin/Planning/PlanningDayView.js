// src/Pages/Admin/Planning/PlanningDayView.jsx
import React, { useMemo } from "react";
import "./PlanningDayView.css";
import { isBusinessDay } from "../../../utils/time";

export default function PlanningDayView({
  date,
  machines = [],
  commandes = [],
  onOpenCommande,
  workStart = 8,
  workEnd = 16,
  lunchStart = 12,
  lunchEnd = 13,
  hideWeekends = true,
  holidays = [], // ex: ['2025-11-01','2025-12-25']
}) {
  // Jour local à minuit (évite le -2h)
  const day = useMemo(() => {
    const d = date ? new Date(date) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [date]);

  // Déterminer si jour ouvré (pas de return avant les hooks)
  const holidaysSet = useMemo(() => new Set(holidays), [holidays]);
  const isBizDay = useMemo(() => isBusinessDay(day, holidaysSet), [day, holidaysSet]);

  // Bornes locales (journée)
  const startOfDay = useMemo(() => {
    const d0 = new Date(day); d0.setHours(workStart, 0, 0, 0); return d0;
  }, [day, workStart]);

  const endOfDay = useMemo(() => {
    const d1 = new Date(day); d1.setHours(workEnd, 0, 0, 0); return d1;
  }, [day, workEnd]);

  // Clamp pause dans les bornes de la journée (robustesse)
  const [lunchStartClamped, lunchEndClamped] = useMemo(() => {
    const ls = Math.min(Math.max(lunchStart, workStart), workEnd);
    const le = Math.min(Math.max(lunchEnd,   workStart), workEnd);
    return [ls, Math.max(le, ls)];
  }, [lunchStart, lunchEnd, workStart, workEnd]);

  // Bornes pause (locales)
  const lunchStartDate = useMemo(() => {
    const d2 = new Date(day); d2.setHours(lunchStartClamped, 0, 0, 0); return d2;
  }, [day, lunchStartClamped]);

  const lunchEndDate = useMemo(() => {
    const d3 = new Date(day); d3.setHours(lunchEndClamped, 0, 0, 0); return d3;
  }, [day, lunchEndClamped]);

  // En-tête horaires: on SAUTE midi (12–13 n’apparaît pas)
  const slots = useMemo(() => {
    const arr = [];
    for (let h = workStart; h < workEnd; h++) {
      if (h >= lunchStartClamped && h < lunchEndClamped) continue; // skip pause
      arr.push(h);
    }
    return arr;
  }, [workStart, workEnd, lunchStartClamped, lunchEndClamped]);

  // Minutes “ouvrées” (on retire la pause de la largeur)
  const minutesBeforeLunch = Math.max(0, (lunchStartDate - startOfDay) / 60000);
  const lunchMinutes = Math.max(0, (lunchEndDate - lunchStartDate) / 60000);

  const totalWorkingMinutes = Math.max(
    0,
    (endOfDay - startOfDay) / 60000 - lunchMinutes
  );

  // Si pas de minutes ouvrées (borne incohérente), on masque l’affichage
  const noWorkingTime = totalWorkingMinutes <= 0;
  const hideAll = (hideWeekends && !isBizDay) || noWorkingTime;

  // Convertit un instant -> offset en minutes sur l’axe OUVRÉ (pause compressée)
  const toWorkingOffsetMin = (t) => {
    if (t <= lunchStartDate) return Math.max(0, (t - startOfDay) / 60000);
    if (t >= lunchEndDate)  return minutesBeforeLunch + (t - lunchEndDate) / 60000;
    // si t est dans la pause, on le “clampe” au début de la pause
    return minutesBeforeLunch;
  };

  const pctFromOffset = (min) =>
    totalWorkingMinutes > 0 ? (min / totalWorkingMinutes) * 100 : 0;

  // Regroupe & tronque à la journée (local)
  const ordersByMachineForDay = useMemo(() => {
    if (hideAll) return new Map(); // on appelle le hook, mais on sort tôt le calcul
    const map = new Map();
    for (const c of commandes || []) {
      if (!c?.start || !c?.end) continue;
      const startMs = new Date(c.start).getTime();
      const endMs   = new Date(c.end).getTime();
      const s = new Date(Math.max(startMs, startOfDay.getTime()));
      const e = new Date(Math.min(endMs,   endOfDay.getTime()));
      if (s >= e) continue;
      const list = map.get(c.machineId) || [];
      list.push({ ...c, start: s, end: e });
      map.set(c.machineId, list);
    }
    for (const [, L] of map) L.sort((a, b) => a.start - b.start);
    return map;
  }, [hideAll, commandes, startOfDay, endOfDay]);

  // Coupe un intervalle par la pause → 1 ou 2 segments
  const splitByLunch = (s, e) => {
    if (e <= lunchStartDate || s >= lunchEndDate) return [[s, e]];
    const segs = [];
    if (s < lunchStartDate) segs.push([s, lunchStartDate]);
    if (e > lunchEndDate)   segs.push([lunchEndDate, e]);
    return segs;
  };

  const labelOf = (o) => o?.client || o?.title || "";

  // Return conditionnel APRÈS tous les hooks
  if (hideAll) {
    return null; // ou <div className="planning-day--empty">Aucune production</div>
  }

  return (
    <div className="planning-day">
      <div className="dayview-table-container">
        <table className="dayview-table">
          <thead>
            <tr>
              <th className="machine-header">Machines</th>
              {slots.map((h) => (
                <th key={h} className="hour-header">
                  {String(h).padStart(2, "0")}–{String(h + 1).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => {
              const machineName = m.name ?? m.nom ?? `Machine ${m.id}`;
              const list = ordersByMachineForDay.get(m.id) || [];
              return (
                <tr key={m.id}>
                  <td className="machine-col">{machineName}</td>
                  <td colSpan={slots.length} className="slot-cell">
                    <div className="timeline-row">
                      {/* Marqueur pause */}
                      <div
                        className="lunch-marker"
                        style={{ left: `${pctFromOffset(minutesBeforeLunch)}%` }}
                        aria-hidden
                      >
                        <span>Pause</span>
                      </div>

                      {/* Commandes */}
                      {list.map((o) =>
                        splitByLunch(o.start, o.end).map(([s, e], i) => {
                          const leftPct = pctFromOffset(toWorkingOffsetMin(s));
                          const widthPctRaw =
                            pctFromOffset(toWorkingOffsetMin(e)) - leftPct;
                          const widthPct = Math.max(0, widthPctRaw); // évite largeur négative

                          return (
                            <div
                              key={`${o.id}-${i}`}
                              className="order-block"
                              onClick={() => onOpenCommande?.(o.id)}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                border: `2px solid ${o?.color || "#000"}`,
                              }}
                              title={`${labelOf(o)}\n${o.start.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} – ${o.end.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`}
                            >
                              {labelOf(o)}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
