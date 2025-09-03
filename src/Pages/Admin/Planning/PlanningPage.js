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
      const endIso = new Date(actualEnd).toISOString();
      const nowMs = new Date(endIso).getTime();

      const { data: rows, error } = await supabase
        .from("planning")
        .select("id, debut, fin, commandeId")
        .eq("commandeId", commandeId);

      if (error) {
        console.error("❌ Erreur fetch planning by commandeId:", error);
        return;
      }
      if (!rows || rows.length === 0) return;

      let current = null;
      for (const r of rows) {
        const s = new Date(r.debut).getTime();
        const e = new Date(r.fin).getTime();
        if (s <= nowMs && nowMs < e) { current = r; break; }
      }

      const mutations = [];
      if (current) {
        mutations.push(supabase.from("planning").update({ fin: endIso }).eq("id", current.id));
      }
      const future = rows.filter(r => {
        const s = new Date(r.debut).getTime();
        return s >= nowMs && (!current || r.id !== current.id);
      });
      if (future.length) {
        mutations.push(supabase.from("planning").delete().in("id", future.map(f => f.id)));
      }
      if (mutations.length) await Promise.all(mutations);

      setPlanning(prev => {
        const deletedIds = new Set(future.map(f => f.id));
        return prev
          .filter(p => !deletedIds.has(p.id))
          .map(p => (current && p.id === current.id ? { ...p, fin: endIso } : p));
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
        supabase.from("planning").select("*"),
      ]);

      const machinesData = mRes.data || [];
      const commandesData = cRes.data || [];
      const planningData = pRes.data || [];

      setMachines(machinesData);
      setCommandes(commandesData);
      setPlanning(planningData);

      // Auto-étendre 'En cours' d'1h si nécessaire et replanifier 'A commencer' à la prochaine heure pleine
      const now = new Date();
      const currentHour = new Date(now);
      currentHour.setMinutes(0, 0, 0);
      const nextHour = new Date(currentHour);
      nextHour.setHours(currentHour.getHours() + 1);
      const startAnchor = nextWorkStart(nextHour, workOpts);

      const planningParMachine = planningData.reduce((acc, ligne) => {
        (acc[ligne.machineId] ||= []).push(ligne);
        return acc;
      }, {});

      const updates = [];
      for (const lignes of Object.values(planningParMachine)) {
        const enrichies = lignes
          .map((p) => {
            const c = commandesData.find((x) => x.id === p.commandeId);
            return c ? { p, c } : null;
          })
          .filter(Boolean);

        const enCours = enrichies.filter(({ c }) => c.statut === "En cours");
        const aCommencer = enrichies.filter(({ c }) => c.statut === "A commencer");
        const autres = enrichies.filter(({ c }) => c.statut !== "En cours" && c.statut !== "A commencer");

        let cursor;
        if (enCours.length > 0) {
          // Traiter tous les ordres "En cours" pour extension automatique
          const sortedEnCours = enCours.sort((A, B) => new Date(A.p.debut) - new Date(B.p.debut));
          let latestEnd = startAnchor;
          
          for (const current of sortedEnCours) {
          const finActuel = new Date(current.p.fin);
            
            // Si l'ordre "En cours" a atteint ou dépassé son heure de fin prévue, l'étendre d'1h
            if (finActuel <= currentHour) {
              const nouvelleFin = addWorkingHours(finActuel, 1, workOpts);
              updates.push({ id: current.p.id, fin: nouvelleFin.toISOString() });
              latestEnd = nouvelleFin;
            } else {
              latestEnd = finActuel;
          }
          }
          cursor = latestEnd;
        } else {
          cursor = new Date(startAnchor);
        }

        // Replanifier les ordres "A commencer" à partir de la prochaine heure pleine disponible
        const queueACommencer = aCommencer
          .map(({ p, c }) => ({
            p,
            c,
            urgent: !!c.urgent,
            deadline: c.dateLivraison || null,
            created_at: c.created_at || p.created_at || null,
            expectedHours:
              c.duree_totale_heures_arrondie ??
              c.duree_totale_heures ??
              (c.duree_totale_heures_minutes ?? c.duree_minutes ?? 0) / 60 ?? 0,
          }))
          .sort(sortByPriority);

        // S'assurer que le cursor est au minimum à la prochaine heure pleine
        if (cursor < nextHour) {
          cursor = nextHour;
        }

        for (const item of queueACommencer) {
          const debutActuel = new Date(item.p.debut);
          const finActuel = new Date(item.p.fin);

          // Planifier à partir de la prochaine heure pleine disponible
          const newDebut = nextWorkStart(cursor, workOpts);
          let newFin = addWorkingHours(newDebut, item.expectedHours, workOpts);

          let plannedCells = workingHoursBetween(newDebut.toISOString(), newFin.toISOString(), workOpts);
          if (plannedCells < item.expectedHours) {
            const delta = item.expectedHours - plannedCells;
            newFin = addWorkingHours(newFin, delta, workOpts);
            plannedCells = workingHoursBetween(newDebut.toISOString(), newFin.toISOString(), workOpts);
          }

          if (newDebut.getTime() !== debutActuel.getTime() || newFin.getTime() !== finActuel.getTime()) {
            updates.push({ id: item.p.id, debut: newDebut.toISOString(), fin: newFin.toISOString() });
          }

          cursor = newFin;
        }

        // Les ordres "Terminée" et autres ne sont pas replanifiés, mais avancent le cursor si nécessaire
        for (const { p } of autres) {
          const finActuel = new Date(p.fin);
          if (finActuel > cursor) cursor = finActuel;
        }
      }

      if (updates.length) {
        await Promise.all(updates.map((u) => supabase.from("planning").update(u).eq("id", u.id)));
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
