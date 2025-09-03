// src/Pages/Admin/Planning/PlanningDayView.jsx
import React, { useMemo } from "react";
import "./PlanningDayView.css";

export default function PlanningDayView({
  date,
  machines = [],
  commandes = [],
  onOpenCommande,
  workStart = 8,
  workEnd = 17,      // ⬅️ défaut 17h
  lunchStart = 12,
  lunchEnd = 13,
}) {
  // Helper: clé normalisée (évite string vs number)
  const keyOf = (v) => String(v);

  // Jour local à minuit (évite le -2h)
  const day = useMemo(() => {
    const d = date ? new Date(date) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [date]);

  // Bornes locales
  const startOfDay = useMemo(() => {
    const d0 = new Date(day);
    d0.setHours(workStart, 0, 0, 0);
    return d0;
  }, [day, workStart]);

  const endOfDay = useMemo(() => {
    const d1 = new Date(day);
    d1.setHours(workEnd, 0, 0, 0);
    return d1;
  }, [day, workEnd]);

  // Bornes pause (locales)
  const lunchStartDate = useMemo(() => {
    const d2 = new Date(day);
    d2.setHours(lunchStart, 0, 0, 0);
    return d2;
  }, [day, lunchStart]);

  const lunchEndDate = useMemo(() => {
    const d3 = new Date(day);
    d3.setHours(lunchEnd, 0, 0, 0);
    return d3;
  }, [day, lunchEnd]);

  // En-tête horaires: on SAUTE midi (12–13 n’apparaît pas)
  const slots = useMemo(() => {
    const arr = [];
    for (let h = workStart; h < workEnd; h++) {
      if (h >= lunchStart && h < lunchEnd) continue; // skip pause
      arr.push(h);
    }
    return arr;
  }, [workStart, workEnd, lunchStart, lunchEnd]);

  // Minutes “ouvrées” (on retire la pause de la largeur)
  const minutesBeforeLunch = Math.max(0, (lunchStartDate - startOfDay) / 60000);
  const lunchMinutes = Math.max(0, (lunchEndDate - lunchStartDate) / 60000);
  const totalWorkingMinutesRaw = Math.max(0, (endOfDay - startOfDay) / 60000 - lunchMinutes);
  const totalWorkingMinutes = totalWorkingMinutesRaw > 0 ? totalWorkingMinutesRaw : 0;

  // Convertit un instant -> offset en minutes sur l’axe OUVRÉ (pause compressée)
  const toWorkingOffsetMin = (t) => {
    if (t <= lunchStartDate) return Math.max(0, (t - startOfDay) / 60000);
    if (t >= lunchEndDate) return minutesBeforeLunch + (t - lunchEndDate) / 60000;
    // si t est dans la pause, on le “clampe” au début de la pause
    return minutesBeforeLunch;
  };

  // ⬅️ garde-fou division par zéro
  const pctFromOffset = (min) => (totalWorkingMinutes > 0 ? (min / totalWorkingMinutes) * 100 : 0);

  // Regroupe & tronque à la journée (local)
  const ordersByMachineForDay = useMemo(() => {
    const map = new Map();
    for (const c of commandes || []) {
      if (!c?.start || !c?.end) continue;
      const start = new Date(c.start);
      const end = new Date(c.end);
      const s = new Date(Math.max(start.getTime(), startOfDay.getTime()));
      const e = new Date(Math.min(end.getTime(), endOfDay.getTime()));
      if (s >= e) continue;

      const k = keyOf(c.machineId ?? c.machine_id ?? c.machine);
      const list = map.get(k) || [];
      list.push({ ...c, start: s, end: e });
      map.set(k, list);
    }
    for (const L of map.values()) {
      L.sort((a, b) => a.start - b.start);
    }
    return map;
  }, [commandes, startOfDay, endOfDay]);

  // Coupe un intervalle par la pause → 1 ou 2 segments
  const splitByLunch = (s, e) => {
    if (e <= lunchStartDate || s >= lunchEndDate) return [[s, e]];
    const segs = [];
    if (s < lunchStartDate) segs.push([s, lunchStartDate]);
    if (e > lunchEndDate) segs.push([lunchEndDate, e]);
    return segs;
  };

  const labelOf = (o) => o?.client || o?.title || "";

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
              const list = ordersByMachineForDay.get(keyOf(m.id)) || []; // ⬅️ clé normalisée
              return (
                <tr key={m.id}>
                  <td className="machine-col">{machineName}</td>
                  <td colSpan={slots.length} className="slot-cell">
                    <div className="timeline-row">
                      {/* Marqueur visuel de la pause (ligne pointillée + libellé) */}
                      <div
                        className="lunch-marker"
                        style={{ left: `${pctFromOffset(minutesBeforeLunch)}%` }}
                        aria-hidden
                      >
                        <span>Pause</span>
                      </div>

                      {/* Commandes — blocs proportionnels, coupés à 12–13 */}
                      {list.map((o) =>
                        splitByLunch(o.start, o.end).map(([s, e], i) => {
                          const leftPct = pctFromOffset(toWorkingOffsetMin(s));
                          const rightPct = pctFromOffset(toWorkingOffsetMin(e));
                          const widthPct = Math.max(0, rightPct - leftPct); // ⬅️ jamais négatif
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
