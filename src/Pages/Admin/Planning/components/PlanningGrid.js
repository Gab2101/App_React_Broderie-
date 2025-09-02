// src/Pages/Admin/Planning/components/PlanningGrid.js
import React, { useMemo } from "react";
import { WORKDAY } from "../../../../utils/time.js"; // 4 niveaux pour remonter à src/utils/time
import { getColorFromId } from "../lib/priority"; // plus de computeUrgency/urgencyColors ici

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

/**
 * Découpe les slots sur la pause déjeuner et sur les bornes de la journée,
 * puis trie les segments par heure de début.
 */
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

/**
 * Regroupe les segments contigus d'une même commande (au sein d'une même machine/journée).
 * Tolérance pour les micro-écarts dus aux arrondis : 1 minute.
 */
/**
 * Regroupe les segments contigus d'une même commande (même machine/jour).
 * On normalise à la minute et on accepte un petit gap (tolérance) car
 * beaucoup de générateurs de créneaux créent des micro-trous.
 */
/**
 * Fusionne les segments d'une même commande (même machine/jour) même s'il existe
 * un petit trou OU un léger chevauchement entre eux.
 * On garde la coupure à midi car elle est faite AVANT ici (cellSegmentsForDay).
 */
function mergeContinuousSegments(segs) {
  if (!segs.length) return [];

  // Réduction de la tolérance pour une précision visuelle exacte
  // Seuls les segments vraiment contigus seront fusionnés
  const toleranceMs = 1 * 60 * 1000; // 1 minute seulement

  // Tri par début (sécurité)
  const sorted = [...segs].sort((a, b) => a.segStart - b.segStart);

  const merged = [];
  let cur = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];

    // Même commande ?
    const sameCmd = s.commandeId === cur.commandeId;

    // Si même commande, on fusionne si le nouveau commence AVANT (ou très
    // peu après) la fin du courant + tolérance. Ça couvre :
    // - chevauchement (s.segStart < cur.segEnd)
    // - contiguïté exacte (s.segStart === cur.segEnd)
    // - petit trou (s.segStart - cur.segEnd <= toleranceMs)
    if (sameCmd && s.segStart <= cur.segEnd + toleranceMs) {
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
  // Correction: calculer la largeur réelle en excluant la pause déjeuner
  const workingWidthMs = ((WORKDAY.lunchStart - WORKDAY.start) + (WORKDAY.end - WORKDAY.lunchEnd)) * 3600 * 1000;
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
            const mergedSegs = mergeContinuousSegments(segs); // ← ★ un seul bloc par plage continue
            const { start } = dayBounds(d);

            return (
              <div
                key={`${m.id}:${i}`}
                className="pgd__cell"
                // Clic sur zone vide → ouvrir la vue jour
                onClick={() => onDayColumnClick?.(d)}
                title={onDayColumnClick ? "Cliquez pour voir la journée" : undefined}
                style={{ cursor: onDayColumnClick ? "pointer" : undefined }}
              >
                {mergedSegs.length === 0 ? (
                  <span className="cell__dash">—</span>
                ) : (
                  mergedSegs.map((seg, idx) => {
                    const commande = commandeById.get(seg.commandeId);
                    const title = commande
                      ? `#${commande.numero} • ${commande.client ?? ""}`
                      : "";

                    const leftPct =
                      ((seg.segStart - start.getTime()) / workingWidthMs) * 100;
                    const widthPct =
                      ((seg.segEnd - seg.segStart) / workingWidthMs) * 100;

                    // Couleur d'urgence UNIQUE pour toute la commande
                    const urgencyColor =
                      (commande && commandeColorMap?.get(commande.id)) || "#000000"; // fallback noir

                    // Couleur de fond stable par commande pour différencier visuellement
                    const fillColor = commande ? getColorFromId(commande.id) : "#eee";

                    return (
                      <div
                        key={`${seg.commandeId}:${seg.segStart}:${seg.segEnd}:${idx}`}
                        className="pgd__bar"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(2, widthPct)}%`,
                          backgroundColor: fillColor,
                          // Bord = couleur d'urgence uniforme (noir si dépassée)
                          boxShadow: `inset 0 0 0 4px ${urgencyColor}`,
                        }}
                        title={title}
                        // Clic sur la barre → ouvrir la commande (sans propager à la cellule)
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
