// src/Pages/Admin/Planning/components/PlanningGrid.js
import React, { useMemo } from "react";
import { WORKDAY } from "../../../../utils/time";
import { getColorFromId } from "../lib/priority";

const PARIS_TZ = "Europe/Paris";

function formatDayFR(d) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: PARIS_TZ,        // ✅ ancre affichage en Europe/Paris
  });
}

function dayBounds(d) {
  // ✅ bornes locales (Paris via Date locale du navigateur)
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), WORKDAY.start, 0, 0, 0);
  const lunchStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), WORKDAY.lunchStart, 0, 0, 0);
  const lunchEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), WORKDAY.lunchEnd, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), WORKDAY.end, 0, 0, 0);
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

/** Segments (clampés jour) + coupure sur pause déjeuner, triés par début */
function cellSegmentsForDay(slots, day) {
  const { lunchStart, lunchEnd } = dayBounds(day);
  const lunchStartMs = lunchStart.getTime();
  const lunchEndMs = lunchEnd.getTime();

  const out = [];
  for (const slot of slots) {
    if (!intersectsDay(slot, day)) continue;

    const s = clampToDay(slot.startMs, day);
    const e = clampToDay(slot.endMs, day);
    if (e <= s) continue;

    // ✅ Cas 100% dans la pause → on ignore (pas de rendu dans 12–13)
    if (s >= lunchStartMs && e <= lunchEndMs) {
      continue;
    }

    // ✅ Coupe si traverse la pause (jamais de segment qui la chevauche)
    if (s < lunchStartMs && e > lunchStartMs) {
      out.push({ ...slot, segStart: s, segEnd: Math.min(e, lunchStartMs) });
      if (e > lunchEndMs) {
        out.push({ ...slot, segStart: Math.max(lunchEndMs, s), segEnd: e });
      }
    } else {
      out.push({ ...slot, segStart: s, segEnd: e });
    }
  }
  out.sort((a, b) => a.segStart - b.segStart);
  return out;
}

/**
 * Fusionne les segments contigus d'une même commande (même machine/jour)
 * sans jamais franchir la pause déjeuner.
 * - tolérance pour micro-gaps/overlaps
 * - pas de fusion si le "trou" englobe exactement la pause [lunchStart, lunchEnd]
 */
function mergeContinuousSegments(segs, lunchStartMs, lunchEndMs) {
  if (!segs.length) return [];

  const toleranceMs = 5 * 60 * 1000; // 5 min

  const sorted = [...segs].sort((a, b) => a.segStart - b.segStart);
  const merged = [];
  let cur = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    const sameCmd = s.commandeId === cur.commandeId;
    const gapCoversLunch = cur.segEnd <= lunchStartMs && s.segStart >= lunchEndMs;

    if (sameCmd && !gapCoversLunch && s.segStart <= cur.segEnd + toleranceMs) {
      cur.segEnd = Math.max(cur.segEnd, s.segEnd);
    } else {
      merged.push(cur);
      cur = { ...s };
    }
  }
  merged.push(cur);
  return merged;
}

export default function PlanningGrid({
  machines,
  dayColumns,
  planningByMachine,
  commandeById,
  commandeColorMap, // Map(commandeId -> couleur d'urgence uniforme)
  onOpenCommande,
  onDayColumnClick, // optionnel
}) {
  const workingWidthMs = (WORKDAY.end - WORKDAY.start) * 3600 * 1000;
  const colStyle = useMemo(
    () => ({ gridTemplateColumns: `200px repeat(${dayColumns.length}, 1fr)` }),
    [dayColumns.length]
  );
  const keyOf = (v) => String(v);

  return (
    <div className="planning-grid-days" style={colStyle}>
      {/* coin */}
      <div className="pgd__corner" />

      {/* entêtes colonnes (jours) */}
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
          <div className="pgd__rowheader">{m.nom ?? m.name ?? `Machine ${m.id}`}</div>
          {dayColumns.map((d, i) => {
            const slots = planningByMachine.get(keyOf(m.id)) || [];
            const segs = cellSegmentsForDay(slots, d);

            const { start, lunchStart, lunchEnd } = dayBounds(d);
            const mergedSegs = mergeContinuousSegments(
              segs,
              lunchStart.getTime(),
              lunchEnd.getTime()
            );

            return (
              <div
                key={`${m.id}:${i}`}
                className="pgd__cell"
                onClick={() => onDayColumnClick?.(d)}
                title={onDayColumnClick ? "Cliquez pour voir la journée" : undefined}
                style={{ cursor: onDayColumnClick ? "pointer" : undefined }}
              >
                {mergedSegs.length === 0 ? (
                  <span className="cell__dash">—</span>
                ) : (
                  mergedSegs.map((seg, idx) => {
                    const commande = commandeById.get(seg.commandeId);
                    const title = commande ? `#${commande.numero} • ${commande.client ?? ""}` : "";

                    const leftPct = ((seg.segStart - start.getTime()) / workingWidthMs) * 100;
                    const widthPct = ((seg.segEnd - seg.segStart) / workingWidthMs) * 100;

                    const urgencyColor =
                      (commande && commandeColorMap?.get(commande.id)) || "#000000";
                    const fillColor = commande ? getColorFromId(commande.id) : "#eee";

                    return (
                      <div
                        key={`${seg.commandeId}:${seg.segStart}:${seg.segEnd}:${idx}`}
                        className="pgd__bar"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(0, widthPct)}%`,
                          backgroundColor: fillColor,
                          boxShadow: `inset 0 0 0 4px ${urgencyColor}`, // bord = couleur d'urgence
                        }}
                        title={title}
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
