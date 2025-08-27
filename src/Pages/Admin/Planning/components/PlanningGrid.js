// src/Pages/Admin/Planning/components/PlanningGrid.js
import React, { useMemo } from "react";
import { WORKDAY } from "../../../../utils/time"; // 4 niveaux pour remonter à src/utils/time
import { getColorFromId, computeUrgency, urgencyColors } from "../lib/priority";

function formatDayFR(d) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function dayBounds(d) {
  const start = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    WORKDAY.start,
    0,
    0,
    0
  );
  const lunchStart = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    WORKDAY.lunchStart,
    0,
    0,
    0
  );
  const lunchEnd = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    WORKDAY.lunchEnd,
    0,
    0,
    0
  );
  const end = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    WORKDAY.end,
    0,
    0,
    0
  );
  return { start, lunchStart, lunchEnd, end };
}

function intersectsDay(slot, day) {
  const { start, end } = dayBounds(day);
  return slot.startMs < end.getTime() && slot.endMs > start.getTime();
}

function clampToDay(ms, day) {
  const { start, end } = dayBounds(day);
  return Math.max(start.getTime(), Math.min(end.getTime(), ms));
}

function cellSegmentsForDay(slots, day) {
  const { lunchStart, lunchEnd } = dayBounds(day);
  const out = [];
  for (const slot of slots) {
    if (!intersectsDay(slot, day)) continue;
    const s = clampToDay(slot.startMs, day);
    const e = clampToDay(slot.endMs, day);
    if (s < lunchStart.getTime() && e > lunchStart.getTime() && e > s) {
      out.push({ ...slot, segStart: s, segEnd: lunchStart.getTime() });
      if (lunchEnd.getTime() < e)
        out.push({ ...slot, segStart: lunchEnd.getTime(), segEnd: e });
    } else {
      out.push({ ...slot, segStart: s, segEnd: e });
    }
  }
  out.sort((a, b) => a.segStart - b.segStart);
  return out;
}

export default function PlanningGrid({
  machines,
  dayColumns,
  planningByMachine,
  commandeById,
  onOpenCommande,
  onDayColumnClick, // ← NOUVEAU (optionnel)
}) {
  const workingWidthMs = (WORKDAY.end - WORKDAY.start) * 3600 * 1000;
  const colStyle = useMemo(
    () => ({ gridTemplateColumns: `200px repeat(${dayColumns.length}, 1fr)` }),
    [dayColumns.length]
  );

  return (
    <div className="planning-grid-days" style={colStyle}>
      {/* coin */}
      <div className="pgd__corner" />

      {/* headers colonnes (jours) */}
      {dayColumns.map((d, i) => (
        <div
          key={i}
          className="pgd__colheader"
          title="Voir la journée"
          style={{ cursor: onDayColumnClick ? "pointer" : undefined }}
          onClick={() => onDayColumnClick?.(d)}
        >
          {formatDayFR(d)}
        </div>
      ))}

      {/* lignes par machine */}
      {machines.map((m) => (
        <React.Fragment key={m.id}>
          <div className="pgd__rowheader">{m.nom}</div>
          {dayColumns.map((d, i) => {
            const slots = planningByMachine.get(m.id) || [];
            const segs = cellSegmentsForDay(slots, d);
            const { start } = dayBounds(d);

            return (
              <div
                key={`${m.id}:${i}`}
                className="pgd__cell"
                // Clic sur zone vide de la cellule → ouvrir la vue jour
                onClick={() => onDayColumnClick?.(d)}
                title={onDayColumnClick ? "Cliquez pour voir la journée" : undefined}
                style={{ cursor: onDayColumnClick ? "pointer" : undefined }}
              >
                {segs.length === 0 ? (
                  <span className="cell__dash">—</span>
                ) : (
                  segs.map((seg) => {
                    const commande = commandeById.get(seg.commandeId);
                    const estDepassee =
                      commande &&
                      new Date(seg.segEnd) > new Date(commande?.dateLivraison);
                    const urgence = estDepassee
                      ? 5
                      : commande
                      ? computeUrgency(commande.dateLivraison)
                      : 1;
                    const title = commande
                      ? `#${commande.numero} • ${commande.client}`
                      : "";

                    const leftPct =
                      ((seg.segStart - start.getTime()) / workingWidthMs) * 100;
                    const widthPct =
                      ((seg.segEnd - seg.segStart) / workingWidthMs) * 100;

                    return (
                      <div
                        key={`${seg.id}:${seg.segStart}`}
                        className="pgd__bar"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(2, widthPct)}%`,
                          backgroundColor: commande
                            ? getColorFromId(commande.id)
                            : "#eee",
                          boxShadow: `inset 0 0 0 4px ${urgencyColors[urgence]}`,
                        }}
                        title={title}
                        // Clic sur la barre = ouvrir la commande (et ne pas déclencher le clic de la cellule)
                        onClick={(e) => {
                          e.stopPropagation();
                          if (commande) onOpenCommande(commande);
                        }}
                      >
                        {commande ? `#${commande.numero}` : ""}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
