<<<<<<< HEAD
// src/Pages/Admin/Planning/components/PlanningGrid.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/** Utilitaires horaires */
function workingHoursPerDay(W) {
  return (W.lunchStart - W.start) + (W.end - W.lunchEnd);
}
function buildDayIndexMap(dayColumns = []) {
  const m = new Map();
  dayColumns.forEach((d, i) => {
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    m.set(k, i);
  });
  return m;
}
function dateToX(date, dayColumns, dayIndexMap, pxPerHour, W) {
  const d = new Date(date);
  if (!dayColumns?.length || !dayIndexMap) return NaN;
  const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayIdx = dayIndexMap.get(dayKey);
  if (dayIdx == null) return NaN;

  const t = d.getHours() + d.getMinutes() / 60;
  const morning   = Math.max(0, Math.min(W.lunchStart, t) - W.start);
  const afternoon = t <= W.lunchEnd ? 0 : Math.max(0, Math.min(W.end, t) - W.lunchEnd);
  const hoursWithinDay = Math.max(0, morning) + Math.max(0, afternoon);

  const dayWidth = workingHoursPerDay(W) * pxPerHour;
  return dayIdx * dayWidth + hoursWithinDay * pxPerHour;
}

/** Fallback: fusionne des slots en "gros blocs" continus par (machine, commande) */
function mergeContinuousFromSlots(planningByMachine) {
  const out = new Map();
  if (!planningByMachine || typeof planningByMachine.forEach !== "function") return out;

  planningByMachine.forEach((slots, midRaw) => {
    const mid = String(midRaw ?? "");
    const byCommande = new Map();
    for (const s of (slots || [])) {
      const cid = s.commandeId ?? s.commandeid ?? s.commande_id ?? s.cid ?? null;
      if (!cid) continue;
      const start = new Date(s.debut ?? s.start ?? s.startMs ?? s.gridStartMs ?? Date.now());
      const end   = new Date(s.fin   ?? s.end   ?? s.endMs   ?? s.gridEndMs   ?? start);
      const cur = byCommande.get(cid);
      if (!cur) {
        byCommande.set(cid, {
          machineId: mid, commandeId: cid, start, end,
          numero: s.numero, color: s.color, statut: s.statut, client: s.client
        });
      } else {
        if (start < cur.start) cur.start = start;
        if (end   > cur.end)   cur.end   = end;
      }
    }
    out.set(mid, Array.from(byCommande.values()));
  });

  return out;
}

/** Style de fond: traits horaires + repère de midi pour chaque jour */
function getHourGridStyle(pxPerHour, W) {
  const hourPx = Math.max(1, pxPerHour); // évite 0px quand très zoomé
  const noonOffset = (W.lunchStart - W.start) * hourPx;
  return {
    backgroundImage: `
      /* lignes horaires très légères */
      repeating-linear-gradient(
        to right,
        var(--gridline) 0px,
        var(--gridline) 1px,
        transparent 1px,
        transparent ${hourPx}px
      ),
      /* trait de midi (un peu plus marqué) */
      linear-gradient(
        to right,
        color-mix(in srgb, var(--gridline) 70%, transparent),
        color-mix(in srgb, var(--gridline) 70%, transparent)
      )
    `,
    backgroundSize: `${hourPx}px 100%, 2px 100%`,
    backgroundPosition: `0 0, ${noonOffset}px 0`,
    backgroundRepeat: `repeat, no-repeat`,
  };
}

export default function PlanningGrid({
  machines = [],                 // [{ id, nom|name }]
  dayColumns = [],               // jours ouvrés (Date[])
  continuousByMachine,           // Map<machineId, blocks[]>
  planningByMachine,             // fallback si l'autre n'est pas fourni
  commandeColorMap,              // Map<commandeId, color>
  rangeStart, rangeEnd,          // dates bornes
  onOpenCommande,
  onDayColumnClick,

  // Groupes: ordre et tailles => entêtes de groupe visibles
  groupMeta,                     // { groups: [{label, size}] }

  // Aspect
  rowHeight = 42,
  groupRowHeight = 28,
  leftWidth = 220,
  autoFit14Days = true,
  pxPerHour: pxPerHourProp,      // si défini, on force ce zoom (scroll horizontal possible)
  WORKDAY = { start: 8, lunchStart: 12, lunchEnd: 13, end: 17 },
}) {
  const rootRef = useRef(null);
  const [containerW, setContainerW] = useState(0);

  // Mesure le conteneur pour l'auto-fit
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerW(e.contentRect.width || 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hoursPerDay = workingHoursPerDay(WORKDAY);
  const dayIndexMap = useMemo(() => buildDayIndexMap(dayColumns), [dayColumns]);

  // Auto-fit exact: calcule un px/heure pour que TOUTES les colonnes visibles tiennent sans scroll
  const effectivePxPerHour = useMemo(() => {
    const days = Math.max(1, dayColumns.length);
    // Si on force le zoom -> on respecte (scroll horizontal permis)
    if (typeof pxPerHourProp === "number" && pxPerHourProp > 0) return pxPerHourProp;

    if (!autoFit14Days || !containerW) {
      // valeur par défaut raisonnable; si ça dépasse, le conteneur pourra scroller (CSS le permet)
      return 48;
    }
    const rightW = Math.max(0, containerW - leftWidth);
    // pas de min clamp -> garantit que 14 jours tiennent sans scroll
    return rightW / (days * hoursPerDay);
  }, [autoFit14Days, containerW, leftWidth, dayColumns.length, hoursPerDay, pxPerHourProp]);

  const dayWidth   = hoursPerDay * effectivePxPerHour;
  const totalRight = dayColumns.length * dayWidth;

  // Sources de blocs: Map attendue, sinon on reconstruit depuis planningByMachine
  const contByMachine = useMemo(() => {
    if (continuousByMachine && typeof continuousByMachine.get === "function") return continuousByMachine;
    return mergeContinuousFromSlots(planningByMachine);
  }, [continuousByMachine, planningByMachine]);

  // Construit les lignes à dessiner en respectant l'ordre de groupMeta
  const rows = useMemo(() => {
    const out = [];
    if (groupMeta?.groups?.length) {
      let i = 0;
      for (const g of groupMeta.groups) {
        out.push({ type: "group", label: g.label });
        for (let k = 0; k < g.size; k++) {
          const m = machines[i++];
          if (m) out.push({ type: "machine", machine: m });
        }
      }
    } else {
      for (const m of machines) out.push({ type: "machine", machine: m });
    }
    return out;
  }, [machines, groupMeta]);

  // En-tête jours (à droite)
  const RightHeader = (
    <div
      className="pg-right-header"
      style={{ display: "grid", gridTemplateColumns: `repeat(${dayColumns.length}, ${dayWidth}px)`, width: totalRight }}
    >
      {dayColumns.map((d, i) => (
        <div
          key={i}
          className="pg-col-header"
          onClick={() => onDayColumnClick?.(new Date(d))}
          role="button"
          title="Voir la vue jour"
        >
          {d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })}
=======
import React from "react";

export default function PlanningGrid({ events = [], onEventClick, onTimeSlotClick }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour) => {
    return events.filter(event => {
      const eventHour = new Date(event.start).getHours();
      return eventHour === hour;
    });
  };

  return (
    <div className="planning-grid">
      <div className="grid-header">
        <div className="time-column">Heure</div>
        <div className="events-column">Événements</div>
      </div>

      {hours.map(hour => (
        <div key={hour} className="grid-row">
          <div className="time-column">
            {hour.toString().padStart(2, '0')}:00
          </div>
          <div
            className="events-column"
            onClick={() => onTimeSlotClick && onTimeSlotClick(hour)}
          >
            {getEventsForHour(hour).map(event => (
              <div
                key={event.id}
                className="event-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick && onEventClick(event);
                }}
              >
                <div className="event-title">{event.title}</div>
                <div className="event-time">
                  {new Date(event.start).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })} - {new Date(event.end).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
        </div>
      ))}
    </div>
  );
<<<<<<< HEAD

  return (
    <div
      className="pg-root"
      ref={rootRef}
      style={{ overflowX: "auto", overflowY: "hidden" }} // scroll possible si zoom manuel
    >
      {/* Header */}
      <div
        className="pg-header"
        style={{
          display: "grid",
          gridTemplateColumns: `${leftWidth}px ${totalRight}px`,
          position: "sticky",
          top: 0,
          zIndex: 3,
          background: "var(--bg)"
        }}
      >
        <div className="pg-left-header">Machines</div>
        {RightHeader}
      </div>

      {/* Corps */}
      <div
        className="pg-body"
        style={{ display: "grid", gridTemplateColumns: `${leftWidth}px ${totalRight}px` }}
      >
        {/* Colonne gauche : noms des machines & entêtes de groupe */}
        <div className="pg-left-col">
          {rows.map((row, idx) => {
            if (row.type === "group") {
              return (
                <div
                  key={`g:${row.label}:${idx}`}
                  className="pg-left-cell"
                  style={{
                    height: groupRowHeight,
                    fontWeight: 700,
                    background: "var(--bg-muted)",
                    borderBottom: "1px solid var(--border-strong)"
                  }}
                >
                  {row.label}
                </div>
              );
            }
            const m = row.machine;
            const name = m.nom ?? m.name ?? `Machine ${m.id ?? idx}`;
            return (
              <div key={String(m.id ?? idx)} className="pg-left-cell" style={{ height: rowHeight }}>
                {name}
              </div>
            );
          })}
        </div>

        {/* Colonne droite : grille + overlay par ligne (avec entêtes de groupe) */}
        <div className="pg-right-col">
          {rows.map((row, idx) => {
            if (row.type === "group") {
              return (
                <div
                  key={`gr:${row.label}:${idx}`}
                  className="pg-right-row"
                  style={{
                    height: groupRowHeight,
                    position: "relative",
                    background: "var(--bg-muted)",
                    borderBottom: "1px solid var(--border-strong)"
                  }}
                />
              );
            }

            const m = row.machine;
            const mid = String(m.id ?? m.machineId ?? m.mid ?? "");
            const blocks = contByMachine.get?.(mid) || [];

            return (
              <div key={mid || idx} className="pg-right-row" style={{ height: rowHeight, position: "relative" }}>
                {/* Grille de fond : cases/jour + traits horaires + midi */}
                <div
                  className="pg-grid-row"
                  style={{ display: "grid", gridTemplateColumns: `repeat(${dayColumns.length}, ${dayWidth}px)` }}
                >
                  {dayColumns.map((_, i) => (
                    <div
                      key={i}
                      className="pg-grid-day"
                      style={{
                        borderRight: "1px solid var(--gridline)",
                        backgroundColor: "var(--surface)",
                        ...getHourGridStyle(effectivePxPerHour, WORKDAY),
                      }}
                    />
                  ))}
                </div>

                {/* Overlay des gros blocs (continu par commande) */}
                <div className="pg-overlay" style={{ position: "absolute", inset: 0 }}>
                  {blocks.map((b) => {
                    let xStart = dateToX(b.start, dayColumns, dayIndexMap, effectivePxPerHour, WORKDAY);
                    let xEnd   = dateToX(b.end,   dayColumns, dayIndexMap, effectivePxPerHour, WORKDAY);

                    if (Number.isNaN(xStart)) {
                      if (rangeStart && b.start <= rangeStart) xStart = 0;
                      else return null;
                    }
                    if (Number.isNaN(xEnd)) {
                      if (rangeEnd && b.end >= rangeEnd) xEnd = totalRight;
                      else return null;
                    }

                    const width = Math.max(1, xEnd - xStart);
                    if (width <= 1) return null;

                    const color = b.color || commandeColorMap?.get?.(b.commandeId);
                    const title = `#${b.numero ?? b.commandeId} • ${b.client ?? ""} • ${b.statut ?? ""}`;

                    return (
                      <div
                        key={`${b.commandeId}:${mid}`}
                        className="pg-block"
                        style={{
                          position: "absolute",
                          left: xStart,
                          width,
                          top: 3,
                          height: rowHeight - 6,
                          background: color || "var(--surface, #fff)",
                          border: "1px solid var(--border-strong, #ddd)",
                          borderRadius: 10,
                          boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 10px",
                          gap: 8,
                          cursor: "pointer",
                          overflow: "hidden",
                          color: "#fff",
                          textAlign: "center",
                        }}
                        onClick={() => onOpenCommande?.(b.commandeId)}
                        title={title}
                      >
                        <span className="pg-block-label">#{b.numero ?? b.commandeId}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
=======
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
}
