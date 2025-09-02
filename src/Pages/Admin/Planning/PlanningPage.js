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
  getNextFullHour,
} from "../../../utils/time";
import { updateCommandeStatut, replaceCommandeInArray } from "../../../utils/CommandesService";
import { getWorkingMinutesBetween, roundToNearest5Minutes, nextWorkStart as utilsNextWorkStart, addWorkingHours as utilsAddWorkingHours } from "../../../utils/time";

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
  const [planning, setPlanning] = useState([]);
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
  const shortenPlanningForCommandeTerminee = useCallback(
    async (commandeId, actualEnd = new Date()) => {
      // S'assurer que actualEnd est arrondi aux 5 minutes
      const roundedActualEnd = roundToNearest5Minutes(actualEnd);
      const endIso = roundedActualEnd.toISOString();
      const nowMs = roundedActualEnd.getTime();

      // 1. Récupérer toutes les assignations de cette commande
      const { data: commandeRows, error: commandeError } = await supabase
        .from("planning")
        .select("id, debut, fin, commandeId, machineId")
        .eq("commandeId", commandeId);

      if (commandeError) {
        console.error("❌ Erreur fetch planning by commandeId:", commandeError);
        return;
      }
      if (!commandeRows || commandeRows.length === 0) return;

      // 2. Identifier l'assignation active (celle qui contient l'instant actuel)
      let currentAssignation = null;
      for (const r of commandeRows) {
        const s = new Date(r.debut).getTime();
        const e = new Date(r.fin).getTime();
        if (s <= nowMs && nowMs < e) { 
          currentAssignation = r; 
          break; 
        }
      }

      if (!currentAssignation) {
        console.warn("Aucune assignation active trouvée pour la commande", commandeId);
        return;
      }

      // 3. Calculer le temps libéré (en minutes ouvrées)
      const originalEnd = new Date(currentAssignation.fin);
      const gapMinutes = getWorkingMinutesBetween(roundedActualEnd, originalEnd, {
        skipNonBusiness: true,
        holidays: new Set()
      });

      // 4. Tronquer l'assignation active
      const mutations = [];
      mutations.push(
        supabase.from("planning").update({ fin: endIso }).eq("id", currentAssignation.id)
      );

      // 5. Supprimer les assignations futures de cette commande
      const futureAssignations = commandeRows.filter(r => {
        const s = new Date(r.debut).getTime();
        return s >= nowMs && r.id !== currentAssignation.id;
      });
      if (futureAssignations.length) {
        mutations.push(
          supabase.from("planning").delete().in("id", futureAssignations.map(f => f.id))
        );
      }

      // 6. Si on a libéré du temps, réorganiser les assignations suivantes sur la même machine
      if (gapMinutes > 0) {
        await compactMachineColumnAfter(roundedActualEnd, currentAssignation.machineId, gapMinutes);
      }

      // 7. Appliquer les mutations
      if (mutations.length) {
        await Promise.all(mutations);
      }

      // 8. Mettre à jour l'état local
      setPlanning(prev => {
        const deletedIds = new Set(futureAssignations.map(f => f.id));
        return prev
          .filter(p => !deletedIds.has(p.id))
          .map(p => (p.id === currentAssignation.id ? { ...p, fin: endIso } : p));
      });
    },
    []
  );

  /**
   * Compacte automatiquement les assignations suivantes sur une machine
   * après qu'une commande soit terminée plus tôt que prévu
   */
  const compactMachineColumnAfter = useCallback(async (dateRef, machineId, gapMinutes) => {
    try {
      // 1. Récupérer toutes les assignations futures sur cette machine
      const { data: futureAssignations, error } = await supabase
        .from("planning")
        .select("id, debut, fin, commandeId, machineId")
        .eq("machineId", machineId)
        .gte("debut", dateRef.toISOString())
        .order("debut", { ascending: true });

      if (error) {
        console.error("❌ Erreur récupération assignations futures:", error);
        return;
      }

      if (!futureAssignations || futureAssignations.length === 0) {
        return; // Rien à compacter
      }

      // 2. Calculer les nouvelles heures pour chaque assignation
      const updates = [];
      let cumulativeShift = gapMinutes;

      for (const assignation of futureAssignations) {
        const originalStart = new Date(assignation.debut);
        const originalEnd = new Date(assignation.fin);
        const duration = getWorkingMinutesBetween(originalStart, originalEnd, {
          skipNonBusiness: true,
          holidays: new Set()
        });

        // Calculer le nouveau début en reculant de cumulativeShift minutes
        const shiftedStartMs = originalStart.getTime() - (cumulativeShift * 60 * 1000);
        let newStart = utilsNextWorkStart(new Date(shiftedStartMs), {
          skipNonBusiness: true,
          holidays: new Set()
        });

        // S'assurer que le nouveau début n'est pas avant dateRef
        if (newStart < dateRef) {
          newStart = utilsNextWorkStart(dateRef, {
            skipNonBusiness: true,
            holidays: new Set()
          });
        }

        // Calculer la nouvelle fin en respectant les heures ouvrées
        const newEnd = utilsAddWorkingHours(newStart, duration / 60, {
          skipNonBusiness: true,
          holidays: new Set()
        });

        // Arrondir aux 5 minutes
        const roundedNewStart = roundToNearest5Minutes(newStart);
        const roundedNewEnd = roundToNearest5Minutes(newEnd);

        updates.push({
          id: assignation.id,
          debut: roundedNewStart.toISOString(),
          fin: roundedNewEnd.toISOString()
        });

        // Réduire le décalage cumulatif pour les assignations suivantes
        const actualShift = getWorkingMinutesBetween(roundedNewStart, originalStart, {
          skipNonBusiness: true,
          holidays: new Set()
        });
        cumulativeShift = Math.max(0, cumulativeShift - actualShift);
      }

      // 3. Appliquer les mises à jour en base
      if (updates.length > 0) {
        await Promise.all(
          updates.map(update => 
            supabase.from("planning").update({
              debut: update.debut,
              fin: update.fin
            }).eq("id", update.id)
          )
        );

        // 4. Mettre à jour l'état local
        setPlanning(prev => 
          prev.map(p => {
            const update = updates.find(u => u.id === p.id);
            return update ? { ...p, debut: update.debut, fin: update.fin } : p;
          })
        );
      }
    } catch (error) {
      console.error("❌ Erreur lors du compactage de la machine:", error);
    }
  }, [getWorkingMinutesBetween, roundToNearest5Minutes, utilsNextWorkStart, utilsAddWorkingHours]);
  // Chargement + réajustement automatique
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

      // Create command lookup map for efficient access
      const commandeByIdMap = new Map();
      for (const cmd of commandesData) {
        commandeByIdMap.set(cmd.id, cmd);
      }

      setMachines(machinesData);
      setCommandes(commandesData);
      setPlanning(planningData);

      // Get the next full hour for scheduling non-"En cours" orders
      const now = new Date();
      const nextFullHour = getNextFullHour(undefined, workOpts);

      const planningParMachine = planningData.reduce((acc, ligne) => {
        (acc[ligne.machineId] ||= []).push(ligne);
        return acc;
      }, {});

      const updates = [];

      // STEP 1: Reschedule all non-"En cours" orders to start at next full hour
      for (const p of planningData) {
        const cmd = commandeByIdMap.get(p.commandeId);
        if (!cmd) continue;

        // Only reschedule orders that are NOT "En cours"
        if (cmd.statut !== "En cours") {
          const currentDebut = new Date(p.debut);
          const newDebut = nextFullHour;
          
          // Calculate new end time based on order duration
          const durationHours = cmd.duree_totale_heures_arrondie ?? cmd.duree_totale_heures ?? 0;
          const newFin = addWorkingHours(newDebut, durationHours, workOpts);

          // Only update if the start time has actually changed
          if (newDebut.getTime() !== currentDebut.getTime()) {
            updates.push({
              id: p.id,
              debut: newDebut.toISOString(),
              fin: newFin.toISOString()
            });
          }
        }
      }

      // STEP 2: Auto-extend "En cours" orders by 1 hour (existing logic)
      for (const lignes of Object.values(planningParMachine)) {
        const enrichies = lignes
          .map((p) => {
            const c = commandeByIdMap.get(p.commandeId);
            return c ? { p, c } : null;
          })
          .filter(Boolean);

        const enCours = enrichies.filter(({ c }) => c.statut === "En cours");

        // Extend "En cours" orders by 1 hour
        if (enCours.length > 0) {
          const current = enCours.sort((A, B) => new Date(B.p.debut) - new Date(A.p.debut))[0];
          const finActuel = new Date(current.p.fin);
          const nouvelleFin = addWorkingHours(finActuel, 1, workOpts);
          if (nouvelleFin.getTime() !== finActuel.getTime()) {
            // Check if this planning entry already has an update from STEP 1
            const existingUpdateIndex = updates.findIndex(u => u.id === current.p.id);
            if (existingUpdateIndex >= 0) {
              // Update the existing entry to also include the extended fin time
              updates[existingUpdateIndex].fin = nouvelleFin.toISOString();
            } else {
              // Add new update for extending "En cours" order
              updates.push({ id: current.p.id, fin: nouvelleFin.toISOString() });
            }
          }
        }
      }

      // Apply all updates to the database
      if (updates.length) {
        await Promise.all(
          updates.map((u) => {
            const updateData = {};
            if (u.debut) updateData.debut = u.debut;
            if (u.fin) updateData.fin = u.fin;
            return supabase.from("planning").update(updateData).eq("id", u.id);
          })
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

  // 🔸 FILTRAGE UI anti-phantoms : libération à l’heure pleine pour commandes "Terminée"
  const filteredPlanning = useMemo(() => {
    if (!planning?.length) return [];
    const out = [];

    for (const row of planning) {
      const cmd = commandeById.get(row.commandeId);
      if (!cmd) { out.push(row); continue; }

      if (String(cmd.statut || "").toLowerCase() !== "terminée") {
        out.push(row);
        continue;
      }

      const tRaw = cmd.realEnd || row.fin || new Date();
      const tFree = ceilToHour(tRaw);

      const dStart = new Date(row.debut);
      const dEnd = new Date(row.fin);

      if (dStart >= tFree) {
        continue;
      }

      if (dStart < tFree && dEnd > tFree) {
        out.push({ ...row, fin: tFree.toISOString() });
        continue;
      }

      out.push(row);
    }

    return out;
  }, [planning, commandeById]);

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

  /** ✅ Planning regroupé par machine — DUPLICATION par machine (multi-machines) */
  const planningByMachine = useMemo(() => {
    const acc = new Map();
    for (const p of filteredPlanning) {
      const entryBase = {
        ...p,
        startMs: parseISOAny(p.debut).getTime(),
        endMs: parseISOAny(p.fin).getTime(),
      };
      const entry = normalizeSlotForGrid(entryBase);

      const mids = normalizeMachineIds(p.machineId);
      for (const mid of mids) {
        if (!acc.has(mid)) acc.set(mid, []);
        acc.get(mid).push({ ...entry, machineId: mid });
      }
    }
    for (const arr of acc.values()) arr.sort((a, b) => a.gridStartMs - b.gridStartMs);
    return acc;
  }, [filteredPlanning]);

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
    for (const p of filteredPlanning) {
      const c = commandeById.get(p.commandeId);
      const client = c?.client || c?.client_nom || c?.client_name || "";
      const color = c ? commandeColorMap.get(c.id) : undefined;

      const mids = normalizeMachineIds(p.machineId);
      for (const mid of mids) {
        out.push({
          id: p.id,                 // id du slot planning
          machineId: String(mid),   // IMPORTANT: clé identique à machines[].id (string)
          start: new Date(p.debut),
          end: new Date(p.fin),
          title: client || `Commande ${p.commandeId}`, // client seul
          status: c?.statut || "",
          color,                    // même couleur que le planning général
        });
      }
    }
    return out;
  }, [filteredPlanning, commandeById, commandeColorMap]);

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
            onOpenCommande={(planningRowId) => {
              const row = filteredPlanning.find(p => p.id === planningRowId);
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
              onTermineeShortenPlanning={shortenPlanningForCommandeTerminee}
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
            planningByMachine={planningByMachine}
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
              onTermineeShortenPlanning={shortenPlanningForCommandeTerminee}
              updateCommandeStatut={updateCommandeStatut}
            />
          )}
        </>
      )}
    </div>
  );
}
