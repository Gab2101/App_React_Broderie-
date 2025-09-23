// src/Pages/Admin/Planning/PlanningPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../../supabaseClient";
import "./PlanningPage.css";
import { WORKDAY } from "../../../utils/time";

import {
  configureSlots,
  nextWorkStart,
  addWorkingHours,
  isBusinessDay,
} from "../../../utils/time";
import { updateCommandeStatut, replaceCommandeInArray } from "../../../utils/CommandesService";

import CommandeModal from "./components/CommandeModal";
import PlanningGrid from "./components/PlanningGrid";
import PlanningDayView from "./PlanningDayView";


import { normalizeSlotForGrid } from "./lib/grid";
import { workingHoursBetween } from "./lib/workingHours";
import { sortByPriority, getUrgencyColor, computeUrgency } from "./lib/priority";

console.log("[Planning] regenerated (gros blocs par commande, non découpés par jour)");

/** ---------- Légende d’urgence ---------- **/
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
      <div className="legend-item">
        <span
          className="legend-color"
          style={{
            background: getUrgencyColor(1, "Terminée"),
            display: "inline-block",
            width: 14,
            height: 14,
            marginRight: 6,
            borderRadius: 3,
          }}
        />
        Terminée
      </div>
    </div>
  );
}

/** -------- Utils Paris -------- */
const PARIS_TZ = "Europe/Paris";
const parisNow = () => new Date();
function parisMidnight(dLike = new Date()) {
  const d = new Date(dLike);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function clampToWorkdayParis(d) {
  const x = new Date(d);
  const day0 = parisMidnight(x);
  const t = x.getHours() + x.getMinutes() / 60;
  const setHM = (h, m = 0) =>
    new Date(day0.getFullYear(), day0.getMonth(), day0.getDate(), h, m, 0, 0);

  if (t < WORKDAY.start) return setHM(WORKDAY.start);
  if (t >= WORKDAY.lunchStart && t < WORKDAY.lunchEnd) return setHM(WORKDAY.lunchEnd);
  if (t >= WORKDAY.end) return setHM(WORKDAY.end);
  return x;
}
function ceilHourWorkParis(d) {
  const r = new Date(d);
  if (r.getMinutes() || r.getSeconds() || r.getMilliseconds()) {
    r.setHours(r.getHours() + 1, 0, 0, 0);
  } else {
    r.setMilliseconds(0);
  }
  return clampToWorkdayParis(r);
}

/** -------- normaliser machineId en tableau de strings -------- */
function normalizeMachineIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
  return [s];
}

/** -------- Grouper les machines par group_label (ordre alpha FR) -------- */
function groupMachinesByLabel(machines) {
  const map = new Map();
  for (const m of machines) {
    const label = m.group_label ?? "Sans groupe";
    if (!map.has(label)) map.set(label, { label, machines: [] });
    map.get(label).machines.push(m);
  }

  const groups = Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "fr", { sensitivity: "base" })
  );

  groups.forEach((g) => {
    g.machines.sort((a, b) => {
      const an = (a.nom ?? a.name ?? "").toString();
      const bn = (b.nom ?? b.name ?? "").toString();
      const byName = an.localeCompare(bn, "fr", { sensitivity: "base" });
      if (byName !== 0) return byName;
      return String(a.id).localeCompare(String(b.id));
    });
  });

  const flat = groups.flatMap((g) => g.machines);

  // indices des dernières lignes de groupe, pour le séparateur horizontal
  const breaks = [];
  let cursor = 0;
  for (const g of groups) {
    cursor += g.machines.length;
    breaks.push(cursor - 1);
  }

  return { groups, flat, breaks };
}

export default function PlanningPage() {
  const [startDate, setStartDate] = useState(() => parisMidnight());
  const [machines, setMachines] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [modalCommande, setModalCommande] = useState(null);

  // Vue jour
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'day'
  const [selectedDate, setSelectedDate] = useState(() => parisMidnight());

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

  /** --- Raccourcir quand “Terminée” --- */
  const shortenPlanningForCommandeTerminee = useCallback(async (commandeId, actualEnd = new Date()) => {
    const roundedEnd = ceilHourWorkParis(actualEnd ?? new Date());
    const endIso = roundedEnd.toISOString();
    const nowMs = roundedEnd.getTime();

    const { data: rows, error } = await supabase
      .from("planning")
      .select("id, debut, fin, commandeId")
      .eq("commandeId", commandeId);

    if (error) {
      console.error("❌ Erreur fetch planning by commandeId:", error);
      return;
    }
    if (!rows?.length) return;

    let current = null;
    for (const r of rows) {
      const s = new Date(r.debut).getTime();
      const e = new Date(r.fin).getTime();
      if (s <= nowMs && nowMs < e) {
        current = r;
        break;
      }
    }

    const mutations = [];
    if (current) {
      mutations.push(supabase.from("planning").update({ fin: endIso }).eq("id", current.id));
    }
    const future = rows.filter((r) => {
      const s = new Date(r.debut).getTime();
      return s >= nowMs && (!current || r.id !== current.id);
    });
    if (future.length) {
      mutations.push(supabase.from("planning").delete().in("id", future.map((f) => f.id)));
    }
    if (mutations.length) await Promise.all(mutations);

    setPlanning((prev) => {
      const deletedIds = new Set(future.map((f) => f.id));
      return prev
        .filter((p) => !deletedIds.has(p.id))
        .map((p) => (current && p.id === current.id ? { ...p, fin: endIso } : p));
    });
  }, []);

  /** --- Chargement + reflow --- */
  const fetchAndReflow = useCallback(async () => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    try {
      const [mRes, cRes, pRes] = await Promise.all([
        supabase.from("machines").select("id, nom, group_label"),
        supabase.from("commandes").select("*"),
        supabase.from("planning").select("*"),
      ]);

      const machinesData = mRes.data || [];
      const commandesData = cRes.data || [];
      const planningData = pRes.data || [];

      setMachines(machinesData);
      setCommandes(commandesData);
      setPlanning(planningData);

      // Ajuste 'En cours' / replanifie 'A commencer'
      const now = parisNow();
      const nextHourParis = ceilHourWorkParis(now);
      const startAnchor = nextWorkStart(nextHourParis, workOpts);

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
        const autres = enrichies.filter(
          ({ c }) => c.statut !== "En cours" && c.statut !== "A commencer"
        );

        let cursor;
        if (enCours.length > 0) {
          const current = enCours.sort((A, B) => new Date(B.p.debut) - new Date(A.p.debut))[0];
          const finActuel = new Date(current.p.fin);
          let target = ceilHourWorkParis(now);
          if (target.getTime() < finActuel.getTime()) target = finActuel;
          if (target.getTime() !== finActuel.getTime()) {
            updates.push({ id: current.p.id, fin: target.toISOString() });
          }
          cursor = target;
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
              (c.duree_totale_heures_minutes ?? c.duree_minutes ?? 0) / 60 ??
              0,
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

          if (
            newDebut.getTime() !== debutActuel.getTime() ||
            newFin.getTime() !== finActuel.getTime()
          ) {
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

  /** --- Realtime commandes --- */
  useEffect(() => {
    const channel = supabase
      .channel("realtime-commandes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          replaceCommandeLocal(payload.new);

          const newStatus = String(payload?.new?.statut || "").toLowerCase();
          const oldStatus = String(payload?.old?.statut || "").toLowerCase();

          const becameTerminee =
            newStatus === "terminée" || newStatus === "terminee"
              ? (oldStatus && oldStatus !== "terminée" && oldStatus !== "terminee") || !oldStatus
              : false;

          if (becameTerminee) {
            const actualEnd = payload?.new?.finished_at ? new Date(payload.new.finished_at) : new Date();
            shortenPlanningForCommandeTerminee(payload.new.id, actualEnd)
              .then(() => fetchAndReflow())
              .catch((e) => console.error("Realtime terminé → ajustement échoué:", e));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [replaceCommandeLocal, fetchAndReflow, shortenPlanningForCommandeTerminee]);

  /** --- Tick horaire auto --- */
  useEffect(() => {
    fetchAndReflow();

    const now = parisNow();
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

  // Anti-phantoms : libération heure pleine pour "Terminée"
  const filteredPlanning = useMemo(() => {
    if (!planning?.length) return [];
    const out = [];

    for (const row of planning) {
      const cmd = commandeById.get(row.commandeId);
      if (!cmd) {
        out.push(row);
        continue;
      }

      if (String(cmd.statut || "").toLowerCase() !== "terminée") {
        out.push(row);
        continue;
      }

      const tRaw = cmd.finished_at || row.fin || new Date();
      const tFree = ceilHourWorkParis(tRaw);

      const dStart = new Date(row.debut);
      const dEnd = new Date(row.fin);

      if (dStart >= tFree) continue;
      if (dStart < tFree && dEnd > tFree) {
        out.push({ ...row, fin: tFree.toISOString() });
        continue;
      }
      out.push(row);
    }

    return out;
  }, [planning, commandeById]);

  // Couleur d’urgence par commande
  const commandeColorMap = useMemo(() => {
    const m = new Map();
    for (const c of commandes) {
      const dateLivraison =
        c.dateLivraison || c.deadline || c.date_livraison || c.date_limite || null;
      const level = computeUrgency(dateLivraison);
      const color = getUrgencyColor(level, c.statut);
      m.set(c.id, color);
    }
    return m;
  }, [commandes]);
  

  // 14 jours ouvrés visibles
  const dayColumns = useMemo(() => {
    const cols = [];
    let added = 0;
    let d = parisMidnight(startDate);
    while (added < 14) {
      if (!isBusinessDay(d, HOLIDAYS)) {
        d = parisMidnight(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
        continue;
      }
      cols.push(new Date(d));
      added++;
      d = parisMidnight(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    }
    return cols;
  }, [startDate, HOLIDAYS]);

  // Regroupement machines pour l'affichage (machines en LIGNES)
  const { groups: machineGroups, flat: groupedMachines, breaks: groupBreakIndices } = useMemo(() => {
    return groupMachinesByLabel(machines || []);
  }, [machines]);

  // --------- Construction des "gros blocs" continus par (machineId, commandeId) ----------
  const continuousBlocksByMachine = useMemo(() => {
    const map = new Map(); // machineId -> Array<block>
    // Index pour label + couleur
    const getLabel = (c) =>
      c?.numero ?? c?.num_commande ?? c?.reference ?? c?.ref ?? c?.id;

    // 1) Rassembler toutes les tranches par (machineId, commandeId)
    const buckets = new Map(); // key: `${mid}::${cid}` -> { mid, cid, start: Date, end: Date }
    for (const row of filteredPlanning) {
  
      const mids = normalizeMachineIds(row.machineId);
      const start = new Date(row.debut);
      const end = new Date(row.fin);
      for (const mid of mids) {
        const key = `${mid}::${row.commandeId}`;
        const b = buckets.get(key);
        if (!b) {
          buckets.set(key, {
            mid,
            cid: row.commandeId,
            start,
            end,
          });
        } else {
          if (start < b.start) b.start = start;
          if (end > b.end) b.end = end;
        }
      }
    }

    // 2) Transformer en blocks par machine
    for (const { mid, cid, start, end } of buckets.values()) {
      if (!map.has(mid)) map.set(mid, []);
      const com = commandeById.get(cid);
      map.get(mid).push({
        machineId: mid,
        commandeId: cid,
        start,
        end,
        numero: getLabel(com),
        color: com ? (commandeColorMap.get(com.id) || undefined) : undefined,
        statut: com?.statut ?? "",
        client: com?.client || com?.client_nom || com?.client_name || "",
      });
    }

    // 3) Tri par début croissant
    for (const arr of map.values()) {
      arr.sort((a, b) => a.start - b.start);
    }
    return map;
  }, [filteredPlanning, commandeById, commandeColorMap]);

  // --------- Fenêtre visible (heures ouvrées compressées) ----------
  const rangeStart = useMemo(() => {
    if (!dayColumns.length) return new Date();
    const d0 = new Date(dayColumns[0]);
    d0.setHours(Math.floor(WORKDAY.start), Math.round((WORKDAY.start % 1) * 60), 0, 0);
    return d0;
  }, [dayColumns]);

  const rangeEnd = useMemo(() => {
    if (!dayColumns.length) return new Date();
    const dn = new Date(dayColumns[dayColumns.length - 1]);
    dn.setHours(Math.floor(WORKDAY.end), Math.round((WORKDAY.end % 1) * 60), 0, 0);
    return dn;
  }, [dayColumns]);

  // ----- Actions vue/controls -----
  const openCommande = useCallback((commande) => setModalCommande(commande), []);
  const goToDay = useCallback((d) => {
    if (!d) d = new Date();
    setSelectedDate(parisMidnight(d));
    setViewMode("day");
  }, []);
  const nextDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = parisMidnight(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);
  const prevDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = parisMidnight(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);
  const backToTable = useCallback(() => setViewMode("table"), []);

  // Vue jour (inchangée)
  const dayViewMachines = useMemo(
    () => machines.map((m) => ({ id: String(m.id), name: m.nom ?? m.name ?? `Machine ${m.id}` })),
    [machines]
  );
  const dayViewOrders = useMemo(() => {
    const out = [];
    for (const p of filteredPlanning) {
      const norm = normalizeSlotForGrid({ debut: p.debut, fin: p.fin });
      const start = new Date(norm.gridStartMs);
      const end = new Date(norm.gridEndMs);
      const c = commandeById.get(p.commandeId);
      const client = c?.client || c?.client_nom || c?.client_name || "";
      const color = c ? commandeColorMap.get(c.id) : undefined;
      const mids = normalizeMachineIds(p.machineId);
      for (const mid of mids) {
        out.push({
          id: p.id,
          machineId: String(mid),
          start,
          end,
          title: client || `Commande ${p.commandeId}`,
          status: c?.statut || "",
          color,
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
          <UrgencyLegend />
          <div className="dayview-header-row">
            <div className="day-badge">
              {new Date(selectedDate).toLocaleDateString("fr-FR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: PARIS_TZ,
              })}
            </div>
          </div>
          <div className="dayview-actions">
            <button onClick={backToTable}>Retour au tableau</button>
            <button onClick={prevDay}>Jour précédent</button>
            <button onClick={nextDay}>Jour suivant</button>
          </div>

          <PlanningDayView
            date={selectedDate}
            machines={dayViewMachines}
            commandes={dayViewOrders}
            workStart={WORKDAY.start}
            workEnd={WORKDAY.end}
            lunchStart={WORKDAY.lunchStart}
            lunchEnd={WORKDAY.lunchEnd}
            onOpenCommande={(planningRowId) => {
              const row = filteredPlanning.find((p) => p.id === planningRowId);
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
          <h2>Planning — Vue Semaine</h2>
          <UrgencyLegend />

          <div className="zoom-buttons">
            <button onClick={() => setStartDate(parisMidnight())}>Aujourd’hui</button>
            <button
              onClick={() => {
                const prev = parisMidnight(startDate);
                prev.setDate(prev.getDate() - 14);
                setStartDate(prev);
              }}
            >
              ← 14 jours précédents
            </button>
            <button
              onClick={() => {
                const next = parisMidnight(startDate);
                next.setDate(next.getDate() + 14);
                setStartDate(next);
              }}
            >
              14 jours suivants →
            </button>
            <button onClick={() => goToDay(new Date())}>Voir aujourd’hui (vue jour)</button>
          </div>

          <PlanningGrid
            machines={groupedMachines}
            dayColumns={dayColumns}
            continuousByMachine={continuousBlocksByMachine}   // (ou laisse planningByMachine en fallback)
            commandeColorMap={commandeColorMap}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onOpenCommande={(commandeId) => {
              const c = commandeById.get(commandeId);
              if (c) openCommande(c);
            }}
            onDayColumnClick={goToDay}
            groupMeta={{
              groups: machineGroups.map(g => ({ label: g.label, size: g.machines.length })),
              breaks: groupBreakIndices,
            }}
            // Affichage
            rowHeight={42}
            leftWidth={220}
            autoFit14Days={true}         // <-- important : 14 jours tiennent sans scroll
            WORKDAY={WORKDAY}
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
