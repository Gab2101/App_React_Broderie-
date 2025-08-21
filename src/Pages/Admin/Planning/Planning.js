import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../../supabaseClient";
import "./Planning.css";
import { configureSlots } from "../../../utils/time";
// Si tu n'as PAS ré‑exporté depuis utils/time.js, remplace la ligne ci‑dessus par :
// import { configureSlots, expandToHourSlots } from "../../../utils/slots";


// ⬇️ adapte le chemin si ton utils est ailleurs (ex: "../../utils/time")
import {
  ONE_HOUR_MS,
  formatHourRangeFR,
  nextWorkStart,
  addWorkingHours,
  isBusinessDay,
  isWorkHour,
} from "../../../utils/time";

// 🔧 Normalisation ISO → UTC
const parseISOAny = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    if (!/[Zz]|[+-]\d{2}:\d{2}$/.test(v)) return new Date(v + 'Z');
    return new Date(v);
  }
  return new Date(v);
};

/* =========================
   Affichage / couleurs
========================= */
const urgencyColors = {
  1: "#4caf50",
  2: "#2196f3",
  3: "#ff9800",
  4: "#f44336",
  5: "#000000",
};

const getColorFromId = (id) => {
  const colors = [
    "#E3F2FD", "#FFF9C4", "#FFECB3", "#F8BBD0", "#D1C4E9",
    "#C8E6C9", "#B3E5FC", "#FFE0B2", "#F0F4C3", "#FFCDD2",
    "#D7CCC8", "#C5CAE9", "#E0F7FA", "#FFF3E0",
  ];
  const index = parseInt(id.toString(), 36) % colors.length;
  return colors[index];
};

const computeUrgency = (dateLivraison) => {
  if (!dateLivraison) return 1;
  const today = new Date();
  const livraison = new Date(dateLivraison);
  const diffDays = Math.ceil((livraison - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 2) return 5;
  if (diffDays < 5) return 4;
  if (diffDays < 10) return 3;
  if (diffDays < 15) return 2;
  return 1;
};

// --- Priorités V1 ---
// 1) urgent (bool) d'abord
// 2) deadline la plus proche
// 3) created_at le plus ancien
const sortByPriority = (a, b) => {
  const au = !!a.urgent;
  const bu = !!b.urgent;
  if (au !== bu) return au ? -1 : 1;

  const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
  const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
  if (da !== db) return da - db;

  const ca = a.created_at ? new Date(a.created_at).getTime() : Infinity;
  const cb = b.created_at ? new Date(b.created_at).getTime() : Infinity;
  return ca - cb;
};

/* =========================
   Helpers grille & perf
========================= */
function floorToHourMs(d) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x.getTime();
}
function ceilToHourMs(d) {
  const x = new Date(d);
  if (x.getMinutes() || x.getSeconds() || x.getMilliseconds()) {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  } else {
    x.setMinutes(0, 0, 0);
  }
  return x.getTime();
}

// Normalisation d’un créneau → demi-ouvert [startHour, endHour[
function normalizeSlotForGrid(slot) {
  const gs = floorToHourMs(parseISOAny(slot.debut));
  const ge = ceilToHourMs(parseISOAny(slot.fin));
  return { ...slot, gridStartMs: gs, gridEndMs: ge };
}

// Heures ouvrées entières entre deux ISO (boucle demi-ouverte)
function workingHoursBetween(startISO, endISO, { skipNonBusiness = true, holidays = new Set() } = {}) {
  const start = parseISOAny(startISO);
  const end   = parseISOAny(endISO);
  if (!(start < end)) return 0;

  const cur = new Date(start);
  if (cur.getMinutes() || cur.getSeconds() || cur.getMilliseconds()) {
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }

  let count = 0;
  while (cur < end) {
    if ((!skipNonBusiness || isBusinessDay(cur, holidays)) && isWorkHour(cur)) {
      count += 1;
    }
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }
  return count;
}


/* =========================
   Composant principal
========================= */
export default function Planning() {
  const [startDate, setStartDate] = useState(new Date());
  const [machines, setMachines] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [modalCommande, setModalCommande] = useState(null);

  // ajoute tes fériés si besoin
  const HOLIDAYS = useMemo(() => new Set([]), []);
  const workOpts = useMemo(() => ({ skipNonBusiness: true, holidays: HOLIDAYS }), [HOLIDAYS]);

  useEffect(() => {
    // Active la logique jours ouvrés/fériés pour expandToHourSlots
    configureSlots({ skipNonBusiness: true, holidays: HOLIDAYS });
  }, [HOLIDAYS]);

  // éviter 2 recalculs simultanés
  const isUpdatingRef = useRef(false);

  /* ---- Récupération données & recalage horaire ---- */
  const fetchAndReflow = useCallback(async () => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    try {
      const [mRes, cRes, pRes] = await Promise.all([
        supabase.from("machines").select("id, nom"),
        supabase.from("commandes").select("*"),
        supabase.from("planning").select("*"),
      ]);

      const machinesData = mRes.data || [];
      const commandesData = cRes.data || [];
      const planningData = pRes.data || [];

      setMachines(machinesData);
      setCommandes(commandesData);
      setPlanning(planningData);

      // Recalage (ancré à la prochaine heure ouvrée en sautant week-ends)
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(now.getHours() + 1);
      const startAnchor = nextWorkStart(nextHour, workOpts);

      // groupage par machine
      const planningParMachine = planningData.reduce((acc, ligne) => {
        (acc[ligne.machineId] ||= []).push(ligne);
        return acc;
      }, {});

      const updates = [];
      for (const lignes of Object.values(planningParMachine)) {
        // Index commandes par ligne de planning
        const enrichies = lignes
          .map((p) => {
            const c = commandesData.find((x) => x.id === p.commandeId);
            return c ? { p, c } : null;
          })
          .filter(Boolean);

        // Séparer "En cours" / "A commencer" / autres
        const enCours = enrichies.filter(({ c }) => c.statut === "En cours");
        const aCommencer = enrichies.filter(({ c }) => c.statut === "A commencer");
        const autres = enrichies.filter(({ c }) => c.statut !== "En cours" && c.statut !== "A commencer");

        // (optionnel) garde-fou : plusieurs "En cours"
        if (enCours.length > 1) {
          console.warn("Plusieurs 'En cours' détectées sur une machine. Une seule sera prolongée.");
        }

        // 1) Figer l'En cours (si plusieurs → on garde la plus récente par début)
        let cursor;
        if (enCours.length > 0) {
          const current = enCours.sort((A, B) => new Date(B.p.debut) - new Date(A.p.debut))[0];
          const finActuel = new Date(current.p.fin);
          const nouvelleFin = addWorkingHours(finActuel, 1, workOpts); // +1h ouvrée
          if (nouvelleFin.getTime() !== finActuel.getTime()) {
            updates.push({ id: current.p.id, fin: nouvelleFin.toISOString() });
          }
          cursor = nouvelleFin;
        } else {
          cursor = new Date(startAnchor);
        }

        // 2) Ordonner la file "A commencer" par priorité
        const queue = aCommencer
          .map(({ p, c }) => ({
            p,
            c,
            urgent: !!c.urgent, // si pas de colonne, false → tri retombe sur deadline
            deadline: c.dateLivraison || null,
            created_at: c.created_at || p.created_at || null,
            expectedHours:
              c.duree_totale_heures_arrondie ??
              c.duree_totale_heures ??
              (c.duree_totale_heures_minutes ?? c.duree_minutes ?? 0) / 60 ??
              0,
          }))
          .sort(sortByPriority);

        // 3) Replanifier chaque "A commencer" en série après le curseur
        for (const item of queue) {
          const debutActuel = new Date(item.p.debut);
          const finActuel = new Date(item.p.fin);

          // On repart toujours du cursor et on ancre sur la prochaine heure ouvrée
          const newDebut = nextWorkStart(cursor, workOpts);

          // Fin en heures ouvrées (entier) — sécurité plannedCells
          let newFin = addWorkingHours(newDebut, item.expectedHours, workOpts);

          // Sécurité: ajuster si le compteur d'heures affichées est inférieur
          let plannedCells = workingHoursBetween(newDebut.toISOString(), newFin.toISOString(), workOpts);
          if (plannedCells < item.expectedHours) {
            const delta = item.expectedHours - plannedCells;
            newFin = addWorkingHours(newFin, delta, workOpts);
            plannedCells = workingHoursBetween(newDebut.toISOString(), newFin.toISOString(), workOpts);
          }

          // Appliquer si changement
          if (newDebut.getTime() !== debutActuel.getTime() || newFin.getTime() !== finActuel.getTime()) {
            updates.push({ id: item.p.id, debut: newDebut.toISOString(), fin: newFin.toISOString() });
          }

          // Avancer le curseur
          cursor = newFin;
        }

        // 4) Les "autres" statuts (Terminée, etc.) : ne pas toucher, mais tenir le curseur si jamais après
        for (const { p } of autres) {
          const finActuel = new Date(p.fin);
          if (finActuel > cursor) cursor = finActuel;
        }
      }

      if (updates.length) {
        await Promise.all(
          updates.map((u) => supabase.from("planning").update(u).eq("id", u.id))
        );
        const { data: planningAfter } = await supabase.from("planning").select("*");
        setPlanning(planningAfter || []);
      }
    } catch (e) {
      console.error("Erreur updatePlanningHeureParHeure:", e);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [workOpts]);

  useEffect(() => {
    // 1er run
    fetchAndReflow();

    // synchro sur l’heure pleine
    const now = new Date();
    const msToNextHour =
      (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();

    let intervalId;
    const timeoutId = setTimeout(() => {
      fetchAndReflow();
      intervalId = setInterval(fetchAndReflow, 60 * 60 * 1000);
    }, msToNextHour);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchAndReflow]);

  /* ---- Pré-indexation pour le rendu ---- */
  const commandeById = useMemo(() => {
    const m = new Map();
    for (const c of commandes) m.set(c.id, c);
    return m;
  }, [commandes]);

  const planningByMachine = useMemo(() => {
    const acc = new Map();
    for (const p of planning) {
      const entryBase = {
        ...p,
        startMs: parseISOAny(p.debut).getTime(),
        endMs: parseISOAny(p.fin).getTime(),
      };
      const entry = normalizeSlotForGrid(entryBase); // ajoute gridStartMs / gridEndMs
      if (!acc.has(p.machineId)) acc.set(p.machineId, []);
      acc.get(p.machineId).push(entry);
    }
    // ⬇️ Tri sur gridStartMs (bornes d’affichage)
    for (const arr of acc.values()) arr.sort((a, b) => a.gridStartMs - b.gridStartMs);
    return acc;
  }, [planning]);

  /* ---- Lignes d’affichage (14 jours OUVRÉS) ---- */
  const rows = useMemo(() => {
    const out = [];
    let addedBusinessDays = 0;
    let day = new Date(startDate);

    while (addedBusinessDays < 14) {
      if (!isBusinessDay(day, HOLIDAYS)) {
        // passe au jour suivant jusqu'à tomber sur un jour ouvré
        day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0);
        continue;
      }
      addedBusinessDays++;

      // matin 8-11
      for (let h = 8; h <= 11; h++) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0);
        out.push({
          type: "work",
          label: formatHourRangeFR(start),
          startTs: start.getTime(),
          endTs: start.getTime() + ONE_HOUR_MS,
          dayOfWeek: start.getDay(),
        });
      }

      // pause déjeuner
      const lunchStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
      out.push({
        type: "lunch",
        label: `${String(day.getDate()).padStart(2,"0")}/${String(day.getMonth()+1).padStart(2,"0")}/${day.getFullYear()} 12 h - 13 h · Pause déjeuner`,
        dayOfWeek: lunchStart.getDay(),
      });

      // après-midi 13-16
      for (let h = 13; h <= 16; h++) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0);
        out.push({
          type: "work",
          label: formatHourRangeFR(start),
          startTs: start.getTime(),
          endTs: start.getTime() + ONE_HOUR_MS,
          dayOfWeek: start.getDay(),
        });
      }

      // jour suivant
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0);
    }
    return out;
  }, [startDate, HOLIDAYS]);

  /* ---- Utilitaire: intersection case/slot (scan linéaire, early break) ---- */
  const getIntersectingSlot = (machineId, startTs, endTs) => {
    const arr = planningByMachine.get(machineId);
    if (!arr || arr.length === 0) return null;
    // arr trié par gridStartMs
    for (const p of arr) {
      if (p.gridStartMs >= endTs) break; // plus d’intersection possible
      if (startTs < p.gridEndMs && endTs > p.gridStartMs) return p;
    }
    return null;
  };
  /* ---- Compte de cellules affichées pour un slot (demi‑ouvert) ---- */
  /* ---- Compte fiable via expandToHourSlots (saut midi/nuit/WE/feriés) ---- */
  const countDisplayedCellsFor = useCallback(
    (slot) => {
      // Comptage direct des heures ouvrées réelles entre début et fin du slot
      const paintedLength = workingHoursBetween(slot.debut, slot.fin, workOpts);

      console.log("DEBUG countDisplayedCellsFor", {
        commandeId: slot.commandeId,
        paintedLength,
        start: slot.debut,
        end: slot.fin
      });

      return paintedLength;
    },
    [workOpts]
  );


  return (
    <div className="planning-page">
      <h2>Planning des machines (vue horaire)</h2>

      <div className="zoom-buttons">
        <button onClick={() => setStartDate(new Date())}>Aujourd’hui</button>
        <button
          onClick={() => {
            const prev = new Date(startDate);
            prev.setDate(prev.getDate() - 14);
            setStartDate(prev);
          }}
        >
          ← Semaine précédente
        </button>
        <button
          onClick={() => {
            const next = new Date(startDate);
            next.setDate(next.getDate() + 14);
            setStartDate(next);
          }}
        >
          Semaine suivante →
        </button>
      </div>

      <div className="legende-planning">
        <h4>Légende :</h4>
        <ul>
          <li><span className="urgency-box" style={{ backgroundColor: "#4caf50" }}></span> Urgence faible (15j+)</li>
          <li><span className="urgency-box" style={{ backgroundColor: "#2196f3" }}></span> Urgence modérée (10–15j)</li>
          <li><span className="urgency-box" style={{ backgroundColor: "#ff9800" }}></span> Urgence élevée (5–10j)</li>
          <li><span className="urgency-box" style={{ backgroundColor: "#f44336" }}></span> Urgence critique (moins de 5j)</li>
          <li><span className="urgency-box" style={{ backgroundColor: "#000000" }}></span> ⚠️ Commande en retard</li>
        </ul>
      </div>

      <div className="planning-table">
        <table>
          <thead>
            <tr>
              <th>Date / Heure</th>
              {machines.map((m) => <th key={m.id}>{m.nom}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              if (row.type === "lunch") {
                return (
                  <tr key={`lunch_${rowIndex}`}>
                    <td
                      colSpan={1 + machines.length}
                      className="lunch-separator"
                      title="Pause déjeuner"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={rowIndex}>
                  <td
                    className={[
                      "time-cell",
                      row.dayOfWeek % 2 === 0 ? "time-cell--even" : "time-cell--odd",
                      row.startTs < Date.now() ? "time-cell--past" : ""
                    ].join(" ").trim()}
                  >
                    {row.label}
                  </td>

                  {machines.map((machine) => {
                    const slot = getIntersectingSlot(machine.id, row.startTs, row.endTs);
                    const commande = slot ? commandeById.get(slot.commandeId) : null;

                    const estDepassee =
                      slot && commande && new Date(slot.fin) > new Date(commande.dateLivraison);

                    const urgence = estDepassee
                      ? 5
                      : commande
                      ? computeUrgency(commande.dateLivraison)
                      : 1;

                    const coloredCells = slot ? countDisplayedCellsFor(slot) : null;
                    const expectedHours = commande ? commande.duree_totale_heures_arrondie : null;

                    // 1ʳᵉ case du bloc ?
                    let isFirstCell = false;
                    if (slot) {
                      isFirstCell = row.startTs <= slot.gridStartMs && row.endTs > slot.gridStartMs;
                    }

                    return (
                      <td
                        key={`${machine.id}_${rowIndex}`}
                        className={`cell ${slot ? "cell--busy" : "cell--free"}`}
                        onClick={() => commande && setModalCommande(commande)}
                        style={{
                          backgroundColor: slot && commande ? getColorFromId(commande.id) : "white",
                          borderLeft: slot ? `6px solid ${urgencyColors[urgence]}` : "1px solid #ddd",
                        }}
                        title={
                          slot && commande
                            ? `#${commande.numero} • ${commande.client}${
                                expectedHours != null ? ` • ${expectedHours} h prévues` : ""
                              }`
                            : ""
                        }
                      >
                        {slot && commande ? (
                          <>
                            <strong>#{commande.numero}</strong><br />
                            {commande.client}
                            {isFirstCell && expectedHours != null && (
                              <div className="cell__progress">
                                {coloredCells}/{expectedHours} h
                              </div>
                            )}
                            {estDepassee && (
                              <div className="cell__late">⚠️ Fin au-delà de la date</div>
                            )}
                          </>
                        ) : (
                          <span className="cell__dash">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalCommande && (
        <div className="modal-overlay" onClick={() => setModalCommande(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Commande #{modalCommande.numero}</h3>
            <p><strong>Client :</strong> {modalCommande.client}</p>
            <p>
              <strong>Date de livraison :</strong>{" "}
              {modalCommande.dateLivraison
                ? new Date(modalCommande.dateLivraison).toLocaleDateString("fr-FR")
                : "—"}
            </p>
            <p><strong>Statut :</strong> {modalCommande.statut || "—"}</p>
            <button onClick={() => setModalCommande(null)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
