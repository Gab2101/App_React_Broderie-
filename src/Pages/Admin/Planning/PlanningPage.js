import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../../supabaseClient";
import "./Planning.css";

import {
  configureSlots,
  nextWorkStart,
  addWorkingHours,
  isBusinessDay,
} from "../../../utils/time";
import { updateCommandeStatut, replaceCommandeInArray } from "../../../utils/CommandesService";

import CommandeModal from "./components/CommandeModal";
import PlanningGrid from "./components/PlanningGrid";
import PlanningDayView from "./PlanningDayView"; // ← vue jour

import { parseISOAny } from "./lib/parse";
import { normalizeSlotForGrid } from "./lib/grid";
import { workingHoursBetween } from "./lib/workingHours";
import { sortByPriority } from "./lib/priority";

console.log("[Planning] module loaded (refactor + inversion jours/machines + vue jour)");

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
        const newPlanning = prev
          .filter(p => !deletedIds.has(p.id))
          .map(p => (current && p.id === current.id ? { ...p, fin: endIso } : p));
        return newPlanning;
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

      // Auto-étendre 'En cours' d'1h et replanifier 'A commencer'
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(now.getHours() + 1);
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
          const current = enCours.sort((A, B) => new Date(B.p.debut) - new Date(A.p.debut))[0];
          const finActuel = new Date(current.p.fin);
          const nouvelleFin = addWorkingHours(finActuel, 1, workOpts);
          if (nouvelleFin.getTime() !== finActuel.getTime()) {
            updates.push({ id: current.p.id, fin: nouvelleFin.toISOString() });
          }
          cursor = nouvelleFin;
        } else {
          cursor = new Date(startAnchor);
        }

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
              (c.duree_totale_heures_minutes ?? c.duree_minutes ?? 0) / 60 ?? 0,
          }))
          .sort(sortByPriority);

        for (const item of queue) {
          const debutActuel = new Date(item.p.debut);
          const finActuel = new Date(item.p.fin);

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

  // Index
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
      const entry = normalizeSlotForGrid(entryBase);
      if (!acc.has(p.machineId)) acc.set(p.machineId, []);
      acc.get(p.machineId).push(entry);
    }
    for (const arr of acc.values()) arr.sort((a, b) => a.gridStartMs - b.gridStartMs);
    return acc;
  }, [planning]);

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

  // Mapping des données pour la vue jour
  const dayViewMachines = useMemo(
    () => machines.map(m => ({ id: m.id, name: m.nom ?? m.name ?? `Machine ${m.id}` })),
    [machines]
  );

  const dayViewOrders = useMemo(() => planning.map(p => ({
    id: p.id,
    machineId: p.machineId,
    start: new Date(p.debut),
    end: new Date(p.fin),
    title: (() => {
      const c = commandeById.get(p.commandeId);
      if (!c) return `Commande ${p.commandeId}`;
      const ref = c.reference || c.ref || c.titre || c.title || c.id;
      const client = c.client || c.client_nom || c.client_name || "";
      return client ? `${client} — ${ref}` : `${ref}`;
    })(),
    status: (commandeById.get(p.commandeId)?.statut) || "",
    urgentLevel: (commandeById.get(p.commandeId)?.urgent ? "high" : "low"),
  })), [planning, commandeById]);

  // ----- Rendu -----
  return (
    <div className="planning-page">
      {viewMode === "day" ? (
        <>
          <h2>Planning — Vue jour</h2>

          <PlanningDayView
            date={selectedDate}
            machines={dayViewMachines}
            commandes={dayViewOrders}
            onBack={backToTable}
            onPrevDay={prevDay}
            onNextDay={nextDay}
            onOpenCommande={(planningRowId) => {
              const row = planning.find(p => p.id === planningRowId);
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
          <h2>Planning des machines (jours en colonnes)</h2>

          <div className="zoom-buttons">
            <button onClick={() => setStartDate(new Date())}>Aujourd’hui</button>
            <button onClick={() => { const prev = new Date(startDate); prev.setDate(prev.getDate() - 14); setStartDate(prev); }}>
              ← 14 jours précédents
            </button>
            <button onClick={() => { const next = new Date(startDate); next.setDate(next.getDate() + 14); setStartDate(next); }}>
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
            onDayColumnClick={goToDay}   // ← clic sur en-tête/cellule de jour
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
