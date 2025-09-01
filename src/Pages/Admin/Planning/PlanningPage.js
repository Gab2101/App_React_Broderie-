// src/Pages/Admin/Planning/PlanningPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../../supabaseClient";
import "./Planning.css";

import {
  configureSlots,
  nextWorkStart,
  addWorkingHours,
  isBusinessDay,
  ceilToHour,
} from "../../../utils/time";
import { updateCommandeStatut, replaceCommandeInArray } from "../../../utils/CommandesService";

import CommandeModal from "./components/CommandeModal";
import PlanningGrid from "./components/PlanningGrid";
import PlanningDayView from "./PlanningDayView";

import { parseISOAny } from "./lib/parse";
import { normalizeSlotForGrid } from "./lib/grid";
import { workingHoursBetween } from "./lib/workingHours";
import { sortByPriority, getUrgencyColor, computeUrgency } from "./lib/priority";

console.log("[Planning] module loaded (refactor + inversion jours/machines + vue jour)");

/** ---------- Légende d’urgence (s’appuie sur tes couleurs 1→5) ---------- **/
export function UrgencyLegend() {
  const labels = {
    1: "Faible (≥ 15 jours)",
    2: "Moyenne (10–14 jours)",
    3: "Élevée (5–9 jours)",
    4: "Critique (2–4 jours)",
    5: "Urgence maximale (< 2 jours ou dépassée)",
  };

  return (
    <div className="urgency-legend">
      {Object.entries(labels).map(([level, label]) => (
        <div key={level} className="legend-item">
          <span
            className="legend-color"
            style={{
              background: getUrgencyColor(Number(level)),
              display: "inline-block",
              width: 14,
              height: 14,
              marginRight: 6,
              borderRadius: 3,
            }}
          />
          {label}
        </div>
      ))}
    </div>
  );
}

/** -------- Helper: normaliser machineId en tableau de strings -------- */
function normalizeMachineIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(x => String(x).trim()).filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.includes(",")) return s.split(",").map(x => x.trim()).filter(Boolean);
  return [s];
}

export default function PlanningPage() {
  console.log("[Planning] render", { time: new Date().toISOString() });

  const [startDate, setStartDate] = useState(new Date());
  const [machines, setMachines] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [assignations, setAssignations] = useState([]);
  const [modalCommande, setModalCommande] = useState(null);

  // ---- états pour la VUE JOUR ----
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'day'
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });

  const HOLIDAYS = useMemo(() => new Set([]), []);
  const workOpts = useMemo(() => ({ skipNonBusiness: true, holidays: HOLIDAYS }), [HOLIDAYS]);

  useEffect(() => {
    configureSlots({ skipNonBusiness: true, holidays: HOLIDAYS });
  }, [HOLIDAYS]);

  const isUpdatingRef = useRef(false);

  const replaceCommandeLocal = useCallback((updated) => {
    setCommandes((prev) => replaceCommandeInArray(prev, updated));
    setModalCommande((cur) => (cur?.id === updated.id ? { ...cur, ...updated } : cur));
  }, []);

  // Realtime update commandes
  useEffect(() => {
    const channel = supabase
      .channel("realtime-commandes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          replaceCommandeLocal(payload.new);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [replaceCommandeLocal]);

  // Raccourcir le planning lorsque statut Terminé
  const shortenAssignationsForCommandeTerminee = useCallback(
    async (commandeId, actualEnd = new Date()) => {
      const endIso = new Date(actualEnd).toISOString();
      const nowMs = new Date(endIso).getTime();

      const { data: rows, error } = await supabase
        .from("commandes_assignations")
        .select("id, planned_start, planned_end, commande_id")
        .eq("commande_id", commandeId);

      if (error) {
        console.error("❌ Erreur fetch assignations by commande_id:", error);
        return;
      }
      if (!rows || rows.length === 0) return;

      let current = null;
      for (const r of rows) {
        const s = new Date(r.planned_start).getTime();
        const e = new Date(r.planned_end).getTime();
        if (s <= nowMs && nowMs < e) { current = r; break; }
      }

      const mutations = [];
      if (current) {
        mutations.push(supabase.from("commandes_assignations").update({ planned_end: endIso }).eq("id", current.id));
      }
      const future = rows.filter(r => {
        const s = new Date(r.planned_start).getTime();
        return s >= nowMs && (!current || r.id !== current.id);
      });
      if (future.length) {
        mutations.push(supabase.from("commandes_assignations").delete().in("id", future.map(f => f.id)));
      }
      if (mutations.length) await Promise.all(mutations);

      setAssignations(prev => {
        const deletedIds = new Set(future.map(f => f.id));
        return prev
          .filter(p => !deletedIds.has(p.id))
          .map(p => (current && p.id === current.id ? { ...p, planned_end: endIso } : p));
      });
    },
    []
  );

  // Chargement + réajustement automatique
  const fetchAndReflow = useCallback(async () => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    try {
      const [mRes, cRes, pRes] = await Promise.all([
        supabase.from("machines").select("id, nom"),
        supabase.from("commandes").select("*"),
        supabase.from("commandes_assignations").select("*"),
      ]);

      const machinesData = mRes.data || [];
      const commandesData = cRes.data || [];
      const assignationsData = pRes.data || [];

      setMachines(machinesData);
      setCommandes(commandesData);
      setAssignations(assignationsData);

      // Auto-étendre 'En cours' d'1h et replanifier 'A commencer'
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(now.getHours() + 1);
      const startAnchor = nextWorkStart(nextHour, workOpts);

      const assignationsParMachine = assignationsData.reduce((acc, assignation) => {
        (acc[assignation.machine_id] ||= []).push(assignation);
        return acc;
      }, {});

      const updates = [];
      for (const assignations of Object.values(assignationsParMachine)) {
        const enrichies = assignations
          .map((a) => {
            const c = commandesData.find((x) => x.id === a.commande_id);
            return c ? { a, c } : null;
          })
          .filter(Boolean);

        const enCours = enrichies.filter(({ c }) => c.statut === "En cours");
        const aCommencer = enrichies.filter(({ c }) => c.statut === "A commencer");
        const autres = enrichies.filter(({ c }) => c.statut !== "En cours" && c.statut !== "A commencer");

        let cursor;
        if (enCours.length > 0) {
          const current = enCours.sort((A, B) => new Date(B.a.planned_start) - new Date(A.a.planned_start))[0];
          const finActuel = new Date(current.a.planned_end);
          const nouvelleFin = addWorkingHours(finActuel, 1, workOpts);
          if (nouvelleFin.getTime() !== finActuel.getTime()) {
            updates.push({ id: current.a.id, planned_end: nouvelleFin.toISOString() });
          }
          cursor = nouvelleFin;
        } else {
          cursor = new Date(startAnchor);
        }

        const queue = aCommencer
          .map(({ a, c }) => ({
            a,
            c,
            urgent: !!c.urgent,
            deadline: c.dateLivraison || null,
            created_at: c.created_at || a.created_at || null,
            expectedHours:
              c.duree_totale_heures_arrondie ??
              c.duree_totale_heures ??
              (a.duration_calc_minutes ?? a.duration_minutes ?? 0) / 60 ?? 0,
          }))
          .sort(sortByPriority);

        for (const item of queue) {
          const debutActuel = new Date(item.a.planned_start);
          const finActuel = new Date(item.a.planned_end);

          const newDebut = nextWorkStart(cursor, workOpts);
          let newFin = addWorkingHours(newDebut, item.expectedHours, workOpts);

          let plannedCells = workingHoursBetween(newDebut.toISOString(), newFin.toISOString(), workOpts);
          if (plannedCells < item.expectedHours) {
            const delta = item.expectedHours - plannedCells;
            newFin = addWorkingHours(newFin, delta, workOpts);
            plannedCells = workingHoursBetween(newDebut.toISOString(), newFin.toISOString(), workOpts);
          }

          if (newDebut.getTime() !== debutActuel.getTime() || newFin.getTime() !== finActuel.getTime()) {
            updates.push({ id: item.a.id, planned_start: newDebut.toISOString(), planned_end: newFin.toISOString() });
          }

          cursor = newFin;
        }

        for (const { a } of autres) {
          const finActuel = new Date(a.planned_end);
          if (finActuel > cursor) cursor = finActuel;
        }
      }

      if (updates.length) {
        await Promise.all(updates.map((u) => supabase.from("commandes_assignations").update(u).eq("id", u.id)));
        const { data: assignationsAfter } = await supabase.from("commandes_assignations").select("*");
        setAssignations(assignationsAfter || []);
      }
    } catch (e) {
      console.error("Erreur updateAssignationsHeureParHeure:", e);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [workOpts]);

  useEffect(() => {
    fetchAndReflow();

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

  // Index commandes
  const commandeById = useMemo(() => {
    const m = new Map();
    for (const c of commandes) m.set(c.id, c);
    return m;
  }, [commandes]);

  // 🔸 FILTRAGE UI anti-phantoms : libération à l'heure pleine pour commandes "Terminée"
  const filteredAssignations = useMemo(() => {
    if (!assignations?.length) return [];
    const out = [];

    for (const assignation of assignations) {
      // Adapter pour compatibilité avec le code existant
      const row = {
        ...assignation,
        debut: assignation.planned_start,
        fin: assignation.planned_end,
        commandeId: assignation.commande_id,
        machineId: assignation.machine_id,
      };
      
      const cmd = commandeById.get(assignation.commande_id);
      if (!cmd) { out.push(row); continue; }

      if (String(cmd.statut || "").toLowerCase() !== "terminée") {
        out.push(row);
        continue;
      }

      const tRaw = cmd.realEnd || assignation.planned_end || new Date();
      const tFree = ceilToHour(tRaw);

      const dStart = new Date(assignation.planned_start);
      const dEnd = new Date(assignation.planned_end);

      if (dStart >= tFree) {
        continue;
      }

      if (dStart < tFree && dEnd > tFree) {
        out.push({ ...row, fin: tFree.toISOString(), planned_end: tFree.toISOString() });
        continue;
      }

      out.push(row);
    }

    return out;
  }, [assignations, commandeById]);

  /** ✅ Couleur d’urgence UNIQUE par commande */
  const commandeColorMap = useMemo(() => {
    const m = new Map();
    for (const c of commandes) {
      const dateLivraison =
        c.dateLivraison || c.deadline || c.date_livraison || c.date_limite || null;

      const level = computeUrgency(dateLivraison);        // 1..5
      const color = getUrgencyColor(level);               // hex (inclut noir si 5)
      m.set(c.id, color);
    }
    return m;
  }, [commandes]);

  /** ✅ Assignations regroupées par machine */
  const assignationsByMachine = useMemo(() => {
    const acc = new Map();
    for (const a of filteredAssignations) {
      const entryBase = {
        ...a,
        startMs: parseISOAny(a.debut).getTime(),
        endMs: parseISOAny(a.fin).getTime(),
      };
      const entry = normalizeSlotForGrid(entryBase);

      const machineId = String(a.machineId);
      if (!acc.has(machineId)) acc.set(machineId, []);
      acc.get(machineId).push({ ...entry, machineId });
    }
    for (const arr of acc.values()) arr.sort((a, b) => a.gridStartMs - b.gridStartMs);
    return acc;
  }, [filteredAssignations]);

  // Colonnes = 14 jours ouvrés
  const dayColumns = useMemo(() => {
    const cols = [];
    let added = 0;
    let d = new Date(startDate);
    while (added < 14) {
      if (!isBusinessDay(d, HOLIDAYS)) {
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
        continue;
      }
      cols.push(new Date(d));
      added++;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
    }
    return cols;
  }, [startDate, HOLIDAYS]);

  // ----- Actions vue/controls -----
  const openCommande = useCallback((commande) => setModalCommande(commande), []);

  const goToDay = useCallback((d) => {
    if (!d) d = new Date();
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    setSelectedDate(dateOnly);
    setViewMode("day");
  }, []);

  const nextDay = useCallback(() => {
    setSelectedDate(prev => { const d = new Date(prev); d.setDate(d.getDate()+1); return d; });
  }, []);

  const prevDay = useCallback(() => {
    setSelectedDate(prev => { const d = new Date(prev); d.setDate(d.getDate()-1); return d; });
  }, []);

  const backToTable = useCallback(() => setViewMode("table"), []);

  // Mapping des données pour la vue jour — DUPLICATION par machine
  const dayViewMachines = useMemo(
    () => machines.map(m => ({ id: String(m.id), name: m.nom ?? m.name ?? `Machine ${m.id}` })),
    [machines]
  );

  const dayViewOrders = useMemo(() => {
    const out = [];
    for (const a of filteredAssignations) {
      const c = commandeById.get(a.commandeId);
      const client = c?.client || c?.client_nom || c?.client_name || "";
      const color = c ? commandeColorMap.get(c.id) : undefined;

      out.push({
        id: a.id,                    // id de l'assignation
        machineId: String(a.machineId), // IMPORTANT: clé identique à machines[].id (string)
        start: new Date(a.debut),
        end: new Date(a.fin),
        title: client || `Commande ${a.commandeId}`, // client seul
        status: c?.statut || "",
        color,                       // même couleur que le planning général
      });
    }
    return out;
  }, [filteredAssignations, commandeById, commandeColorMap]);

  // ----- Rendu -----
  return (
    <div className="planning-page">
      {viewMode === "day" ? (
        <>
          <h2>Planning — Vue jour</h2>

          {/* Légende en haut */}
          <UrgencyLegend />

          {/* Badge de date */}
          <div className="dayview-header-row">
            <div className="day-badge">
              {new Date(selectedDate).toLocaleDateString("fr-FR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>

          {/* Actions étirées */}
          <div className="dayview-actions">
            <button onClick={backToTable}>Retour au tableau</button>
            <button onClick={prevDay}>Jour précédent</button>
            <button onClick={nextDay}>Jour suivant</button>
          </div>

          <PlanningDayView
            date={selectedDate}
            machines={dayViewMachines}
            commandes={dayViewOrders}
            // ⬇️ pas de onBack/onPrevDay/onNextDay pour éviter les doublons
            onOpenCommande={(assignationId) => {
              const row = filteredAssignations.find(a => a.id === assignationId);
              if (!row) return;
              const c = commandeById.get(row.commandeId);
              if (c) openCommande(c);
            }}
          />

          {modalCommande && (
            <CommandeModal
              key={`${modalCommande.id}:${modalCommande.statut ?? ""}`}
              commande={modalCommande}
              onClose={() => setModalCommande(null)}
              onOptimisticReplace={replaceCommandeLocal}
              onTermineeShortenPlanning={shortenAssignationsForCommandeTerminee}
              updateCommandeStatut={updateCommandeStatut}
            />
          )}
        </>
      ) : (
        <>
          <h2>Planning — Vue tableau</h2>

          {/* Légende toujours visible */}
          <UrgencyLegend />

          <div className="zoom-buttons">
            <button onClick={() => setStartDate(new Date())}>Aujourd’hui</button>
            <button onClick={() => {
              const prev = new Date(startDate);
              prev.setDate(prev.getDate() - 14);
              setStartDate(prev);
            }}>
              ← 14 jours précédents
            </button>
            <button onClick={() => {
              const next = new Date(startDate);
              next.setDate(next.getDate() + 14);
              setStartDate(next);
            }}>
              14 jours suivants →
            </button>
            <button onClick={() => goToDay(new Date())}>Voir aujourd’hui (vue jour)</button>
          </div>

          <PlanningGrid
            machines={machines}
            dayColumns={dayColumns}
            planningByMachine={assignationsByMachine}
            commandeById={commandeById}
            onOpenCommande={openCommande}
            onDayColumnClick={goToDay}
            commandeColorMap={commandeColorMap}  // ✅ couleurs corrigées
          />

          {modalCommande && (
            <CommandeModal
              key={`${modalCommande.id}:${modalCommande.statut ?? ""}`}
              commande={modalCommande}
              onClose={() => setModalCommande(null)}
              onOptimisticReplace={replaceCommandeLocal}
              onTermineeShortenPlanning={shortenAssignationsForCommandeTerminee}
              updateCommandeStatut={updateCommandeStatut}
            />
          )}
        </>
      )}
    </div>
  );
}
