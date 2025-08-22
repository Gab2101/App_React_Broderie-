import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../../supabaseClient";
import "./Planning.css";
import { configureSlots } from "../../../utils/time";
// Si tu n'as PAS ré-exporté depuis utils/time.js :
// import { configureSlots, expandToHourSlots } from "../../../utils/slots";

import {
  ONE_HOUR_MS,
  formatHourRangeFR,
  nextWorkStart,
  addWorkingHours,
  isBusinessDay,
  isWorkHour,
} from "../../../utils/time";

import { updateCommandeStatut, replaceCommandeInArray } from "../../../utils/CommandesService";

/* =========================
   Helpers génériques
========================= */

// 🔧 Normalisation ISO → UTC (tolère ISO sans suffixe Z)
const parseISOAny = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    if (!/[Zz]|[+-]\d{2}:\d{2}$/.test(v)) return new Date(v + "Z");
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

// --- Priorisation V1 ---
// 1) urgent (bool)  2) deadline  3) created_at
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
   Modal Commande (select statut + sync)
========================= */
function CommandeModal({ commande, onClose, onOptimisticReplace, onTermineeShortenPlanning }) {
  const STATUTS = ["A commencer", "En cours", "En pause", "Terminée", "Annulée"];
  const [statut, setStatut] = React.useState(commande?.statut ?? "A commencer");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  // 🔁 Re-synchronise l'état local quand la commande ou son statut changent
  React.useEffect(() => {
    setStatut(commande?.statut ?? "A commencer");
  }, [commande?.id, commande?.statut]);

  const handleSave = async () => {
    if (!commande?.id) return;
    setSaving(true);
    setError("");

    // Optimistic UI (remonté vers le parent)
    const optimistic = { ...commande, statut };
    onOptimisticReplace?.(optimistic);

    try {
      const saved = await updateCommandeStatut(commande.id, statut);
      onOptimisticReplace?.(saved); // conforte (timestamps, etc.)

      // ⬇️ Raccourcir tout de suite le créneau de planning si Terminée
      if (statut === "Terminée") {
        await onTermineeShortenPlanning?.(commande.id, new Date());
      }

      onClose();
    } catch (e) {
      setError(e.message ?? "Erreur inconnue");
      onOptimisticReplace?.(commande); // rollback visuel
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Commande #{commande.numero}</h3>
        <p><strong>Client :</strong> {commande.client}</p>
        <p>
          <strong>Date de livraison :</strong>{" "}
          {commande.dateLivraison
            ? new Date(commande.dateLivraison).toLocaleDateString("fr-FR")
            : "—"}
        </p>

        <label className="field" style={{ display: "block", marginTop: 12 }}>
          <span style={{ display: "block", marginBottom: 6 }}>
            <strong>Statut</strong>
          </span>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} disabled={saving}>
            {STATUTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}

        <div className="modal-actions" style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={saving}>Fermer</button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
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
    // Active la logique jours ouvrés/fériés
    configureSlots({ skipNonBusiness: true, holidays: HOLIDAYS });
  }, [HOLIDAYS]);

  // éviter 2 recalculs simultanés
  const isUpdatingRef = useRef(false);

  // Remplacement local robuste (optimistic + Realtime)
  const replaceCommandeLocal = useCallback((updated) => {
    setCommandes((prev) => replaceCommandeInArray(prev, updated));
    setModalCommande((cur) => (cur?.id === updated.id ? { ...cur, ...updated } : cur));
  }, []);

  // Abonnement Realtime: propage les UPDATE de 'commandes'
  useEffect(() => {
    const channel = supabase
      .channel("realtime-commandes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => replaceCommandeLocal(payload.new)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [replaceCommandeLocal]);

  /* ---- Raccourcir planning quand une commande passe Terminée ---- */
  const shortenPlanningForCommandeTerminee = useCallback(
    async (commandeId, actualEnd = new Date()) => {
      const endIso = new Date(actualEnd).toISOString();

      // 1) rows concernés
      const { data: rows, error } = await supabase
        .from("planning")
        .select("id, debut, fin, commandeId")
        .eq("commandeId", commandeId);

      if (error) {
        console.error("Erreur fetch planning by commandeId:", error);
        return;
      }
      if (!rows || rows.length === 0) return;

      // 2) MAJ DB
      await Promise.all(
        rows.map((r) =>
          supabase.from("planning").update({ fin: endIso }).eq("id", r.id)
        )
      );

      // 3) MAJ locale immuable (évite disparition/flash)
      setPlanning((prev) =>
        prev.map((p) => (rows.some((r) => r.id === p.id) ? { ...p, fin: endIso } : p))
      );
    },
    []
  );

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

        // 1) Figer/prolonger la commande En cours (+1h ouvrée)
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
            urgent: !!c.urgent,
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

        // 4) Les "autres" statuts : ne pas toucher, mais tenir le curseur si jamais après
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

  /* ---- Compte fiable via heures ouvrées réelles (min 1 case) ---- */
  const countDisplayedCellsFor = useCallback(
    (slot) => {
      const cells = workingHoursBetween(slot.debut, slot.fin, workOpts);
      return Math.max(1, cells); // <= crucial pour micro-commandes (08:49→08:55)
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
        <CommandeModal
          // 🔑 Force un remount si id ou statut changent (évite un état interne obsolète)
          key={`${modalCommande.id}:${modalCommande.statut ?? ""}`}
          commande={modalCommande}
          onClose={() => setModalCommande(null)}
          onOptimisticReplace={replaceCommandeLocal}
          onTermineeShortenPlanning={shortenPlanningForCommandeTerminee}
        />
      )}
    </div>
  );
}
