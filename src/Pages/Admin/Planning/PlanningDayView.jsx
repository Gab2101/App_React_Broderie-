<<<<<<< HEAD
// src/Pages/Admin/Planning/PlanningDayView.jsx
import React, { useMemo } from "react";
import "./PlanningDayView.css";

const PARIS_TZ = "Europe/Paris";
const parisMidnight = (dLike = new Date()) => {
  const d = new Date(dLike);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

export default function PlanningDayView({
  date,
  machines = [],
  commandes = [],
  onOpenCommande,
  workStart,
  workEnd,
  lunchStart,
  lunchEnd,
}) {
  // Helper: normalise les clés (évite string vs number)
  const keyOf = (v) => String(v);

  // Jour ancré à minuit Paris (évite glissements DST)
  const day = useMemo(() => parisMidnight(date ?? new Date()), [date]);

  // Bornes locales (Paris)
  const startOfDay = useMemo(() => {
    const d0 = parisMidnight(day);
    d0.setHours(workStart, 0, 0, 0);
    return d0;
  }, [day, workStart]);

  const endOfDay = useMemo(() => {
    const d1 = parisMidnight(day);
    d1.setHours(workEnd, 0, 0, 0);
    return d1;
  }, [day, workEnd]);

  // Bornes pause (Paris)
  const lunchStartDate = useMemo(() => {
    const d2 = parisMidnight(day);
    d2.setHours(lunchStart, 0, 0, 0);
    return d2;
  }, [day, lunchStart]);

  const lunchEndDate = useMemo(() => {
    const d3 = parisMidnight(day);
    d3.setHours(lunchEnd, 0, 0, 0);
    return d3;
  }, [day, lunchEnd]);

  // En-tête horaires : on SAUTE la pause (12–13 n’apparaît pas)
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

  // Garde-fou division par zéro
  const pctFromOffset = (min) => (totalWorkingMinutes > 0 ? (min / totalWorkingMinutes) * 100 : 0);

  // Regroupe & tronque à la journée (Paris)
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
    for (const L of map.values()) L.sort((a, b) => a.start - b.start);
    return map;
  }, [commandes, startOfDay, endOfDay]);

  /**
   * Coupe un intervalle par la pause → 1, 2 segments, ou un "marqueur pause" si 100% dans la pause.
   * On renvoie des tuples [s, e, kind?] avec kind === "LUNCH_MARKER" pour le cas particulier 12–13.
   */
  const splitByLunch = (s, e) => {
    // 100% dans la pause → renvoie un marqueur virtuel centré
    if (s >= lunchStartDate && e <= lunchEndDate) {
      const mid = new Date((lunchStartDate.getTime() + lunchEndDate.getTime()) / 2);
      return [[mid, mid, "LUNCH_MARKER"]];
    }

    // Entièrement avant ou après la pause → segment unique
    if (e <= lunchStartDate || s >= lunchEndDate) return [[s, e]];

    // Traverse la pause → deux segments
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
              const list = ordersByMachineForDay.get(keyOf(m.id)) || []; // clé normalisée
              return (
                <tr key={m.id}>
                  <td className="machine-col">{machineName}</td>
                  <td colSpan={slots.length} className="slot-cell">
                    <div className="timeline-row">
                      {/* Marqueur visuel fixe de la pause (ligne pointillée + libellé) */}
                      <div
                        className="lunch-marker"
                        style={{ left: `${pctFromOffset(minutesBeforeLunch)}%` }}
                        aria-hidden
                      >
                        <span>Pause</span>
                      </div>

                      {/* Commandes — blocs proportionnels, coupés à 12–13 */}
                      {list.map((o) =>
                        splitByLunch(o.start, o.end).map(([s, e, kind], i) => {
                          // Cas spécial : commande entièrement pendant la pause → petit trait cliquable
                          if (kind === "LUNCH_MARKER") {
                            const leftPct = pctFromOffset(minutesBeforeLunch);
                            return (
                              <div
                                key={`${o.id}-marker-${i}`}
                                className="order-block order-block--lunch"
                                onClick={() => onOpenCommande?.(o.id)}
                                style={{
                                  left: `calc(${leftPct}% - 1px)`,
                                  width: "2px",
                                  minWidth: "2px",
                                  border: "none",
                                  background: o?.color || "currentColor",
                                }}
                                title={`${labelOf(o)}\n(12:00–13:00)`}
                              />
                            );
                          }

                          const leftPct = pctFromOffset(toWorkingOffsetMin(s));
                          const rightPct = pctFromOffset(toWorkingOffsetMin(e));
                          const widthPct = Math.max(0, rightPct - leftPct); // jamais négatif

                          return (
                            <div
                              key={`${o.id}-${i}`}
                              className="order-block"
                              onClick={() => onOpenCommande?.(o.id)}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                // garde-fou : si width==0% (arrondi extrême), on garde 2px visibles
                                minWidth: widthPct > 0 ? undefined : "2px",
                                border: `2px solid ${o?.color || "#000"}`,
                              }}
                              title={`${labelOf(o)}\n${o.start.toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: PARIS_TZ,
                              })} – ${o.end.toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: PARIS_TZ,
                              })}`}
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
=======
import React from "react";

export default function PlanningDayView({ date, events, onEventClick }) {
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="planning-day-view">
      <h3>{formatDate(date)}</h3>

      <div className="day-events">
        {events.length === 0 ? (
          <p className="no-events">Aucun événement prévu pour cette journée</p>
        ) : (
          events.map(event => (
            <div
              key={event.id}
              className="event-item"
              onClick={() => onEventClick(event)}
            >
              <div className="event-time">
                {formatTime(event.start)} - {formatTime(event.end)}
              </div>
              <div className="event-title">{event.title}</div>
              <div className="event-description">{event.description}</div>
            </div>
          ))
        )}
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
      </div>
    </div>
  );
}
