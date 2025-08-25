import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../../supabaseClient";
import "./Planning.css";
import { configureSlots } from "../../../utils/time";
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

console.log("[Planning] module loaded");

/* =========================
   Helpers génériques
========================= */
const parseISOAny = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const noTZ = !/[Zz]|[+-]\d{2}:\d{2}$/.test(v);
    if (parseISOAny.__dbgCount < 3) {
      console.log("[parseISOAny]", { in: v, noTZ, out: noTZ ? v + "Z" : v });
      parseISOAny.__dbgCount++;
    }
    return new Date(noTZ ? v + "Z" : v);
  }
  return new Date(v);
};
parseISOAny.__dbgCount = 0;

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

// Priorisation V1
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
function normalizeSlotForGrid(slot) {
  const gs = floorToHourMs(parseISOAny(slot.debut));
  const ge = ceilToHourMs(parseISOAny(slot.fin));
  if (!normalizeSlotForGrid.__once) {
    normalizeSlotForGrid.__once = true;
    console.log("[normalizeSlotForGrid] sample", {
      in_debut: slot.debut,
      in_fin: slot.fin,
      gsISO: new Date(gs).toISOString(),
      geISO: new Date(ge).toISOString(),
    });
  }
  return { ...slot, gridStartMs: gs, gridEndMs: ge };
}
normalizeSlotForGrid.__once = false;

function workingHoursBetween(startISO, endISO, { skipNonBusiness = true, holidays = new Set() } = {}) {
  const start = parseISOAny(startISO);
  const end   = parseISOAny(endISO);

  if (!workingHoursBetween.__once) {
    workingHoursBetween.__once = true;
    console.groupCollapsed("[workingHoursBetween] sample");
    console.log("startISO/endISO", startISO, endISO);
    console.log("start/end local", start.toString(), end.toString());
    console.log("opts", { skipNonBusiness, holidaysSize: holidays.size });
    console.groupEnd();
  }

  if (!(start < end)) return 0;
  const cur = new Date(start);
  if (cur.getMinutes() || cur.getSeconds() || cur.getMilliseconds()) {
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }
  let count = 0;
  while (cur < end) {
    if ((!skipNonBusiness || isBusinessDay(cur, holidays)) && isWorkHour(cur)) count += 1;
    cur.setHours(cur.getHours() + 1, 0, 0, 0);
  }
  return count;
}
workingHoursBetween.__once = false;

/* =========================
   Modal Commande
========================= */
function CommandeModal({ commande, onClose, onOptimisticReplace, onTermineeShortenPlanning }) {
  const STATUTS = ["A commencer", "En cours", "En pause", "Terminée", "Annulée"];
  const [statut, setStatut] = React.useState(commande?.statut ?? "A commencer");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setStatut(commande?.statut ?? "A commencer");
  }, [commande?.id, commande?.statut]);

  const handleSave = async () => {
    if (!commande?.id) return;
    console.log("🟢 handleSave()", { id: commande.id, statutSelectionne: statut });
    setSaving(true);
    setError("");

    const optimistic = { ...commande, statut };
    onOptimisticReplace?.(optimistic);

    try {
      const saved = await updateCommandeStatut(commande.id, statut);
      console.log("💾 updateCommandeStatut OK", saved?.id, saved?.statut);
      onOptimisticReplace?.(saved);

      if (statut === "Terminée") {
        console.log("✂️ statut === 'Terminée' → appel onTermineeShortenPlanning");
        await onTermineeShortenPlanning?.(commande.id, new Date());
        console.log("✅ onTermineeShortenPlanning terminé");
      }
      onClose();
    } catch (e) {
      console.error("❌ handleSave error", e);
      onOptimisticReplace?.(commande);
      setError(e.message ?? "Erreur inconnue");
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
          {commande.dateLivraison ? new Date(commande.dateLivraison).toLocaleDateString("fr-FR") : "—"}
        </p>

        <label className="field" style={{ display: "block", marginTop: 12 }}>
          <span style={{ display: "block", marginBottom: 6 }}>
            <strong>Statut</strong>
          </span>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} disabled={saving}>
            {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
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
  console.log("[Planning] render", { time: new Date().toISOString() });

  const [startDate, setStartDate] = useState(new Date());
  const [machines, setMachines] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [modalCommande, setModalCommande] = useState(null);

  const HOLIDAYS = useMemo(() => new Set([]), []);
  const workOpts = useMemo(() => ({ skipNonBusiness: true, holidays: HOLIDAYS }), [HOLIDAYS]);

  // 🔧 log "rows" une seule fois sans référencer 'rows' pendant sa création
  const rowsLoggedRef = useRef(false);

  useEffect(() => {
    console.log("[Planning] configureSlots");
    configureSlots({ skipNonBusiness: true, holidays: HOLIDAYS });
  }, [HOLIDAYS]);

  const isUpdatingRef = useRef(false);

  const replaceCommandeLocal = useCallback((updated) => {
    console.log("[Planning] replaceCommandeLocal", updated?.id);
    setCommandes((prev) => replaceCommandeInArray(prev, updated));
    setModalCommande((cur) => (cur?.id === updated.id ? { ...cur, ...updated } : cur));
  }, []);

  useEffect(() => {
    console.log("[Planning] subscribe realtime-commandes");
    const channel = supabase
      .channel("realtime-commandes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          console.log("[Realtime commandes] UPDATE", payload?.new?.id);
          replaceCommandeLocal(payload.new);
        }
      )
      .subscribe();
    return () => {
      console.log("[Planning] unsubscribe realtime-commandes");
      supabase.removeChannel(channel);
    };
  }, [replaceCommandeLocal]);

  const shortenPlanningForCommandeTerminee = useCallback(
    async (commandeId, actualEnd = new Date()) => {
      const endIso = new Date(actualEnd).toISOString();
      const nowMs = new Date(endIso).getTime();

      console.log("🟢 shortenPlanningForCommandeTerminee déclenchée", { commandeId, endIso });

      const { data: rows, error } = await supabase
        .from("planning")
        .select("id, debut, fin, commandeId")
        .eq("commandeId", commandeId);

      if (error) {
        console.error("❌ Erreur fetch planning by commandeId:", error);
        return;
      }
      if (!rows || rows.length === 0) {
        console.log("⚠️ Aucun slot trouvé pour cette commande");
        return;
      }

      console.log("📋 Slots trouvés:", rows);

      let current = null;
      for (const r of rows) {
        const s = new Date(r.debut).getTime();
        const e = new Date(r.fin).getTime();
        if (s <= nowMs && nowMs < e) { current = r; break; }
      }

      if (current) console.log("✂️ Bloc courant à raccourcir:", current);
      else console.log("ℹ️ Aucun bloc courant trouvé (peut-être déjà fini)");

      const mutations = [];
      if (current) {
        mutations.push(supabase.from("planning").update({ fin: endIso }).eq("id", current.id));
      }

      const future = rows.filter(r => {
        const s = new Date(r.debut).getTime();
        return s >= nowMs && (!current || r.id !== current.id);
      });

      if (future.length) {
        console.log("🗑️ Blocs futurs supprimés:", future);
        mutations.push(supabase.from("planning").delete().in("id", future.map(f => f.id)));
      }

      if (mutations.length) {
        console.log("🚀 Application des mutations en base:", mutations.length);
        await Promise.all(mutations);
      }

      setPlanning(prev => {
        const deletedIds = new Set(future.map(f => f.id));
        const newPlanning = prev
          .filter(p => !deletedIds.has(p.id))
          .map(p => (current && p.id === current.id ? { ...p, fin: endIso } : p));

        console.log("✅ MAJ locale planning:", newPlanning);
        return newPlanning;
      });
    },
    []
  );

  const fetchAndReflow = useCallback(async () => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    console.log("[Planning] fetchAndReflow: start");

    try {
      const [mRes, cRes, pRes] = await Promise.all([
        supabase.from("machines").select("id, nom"),
        supabase.from("commandes").select("*"),
        supabase.from("planning").select("*"),
      ]);

      const machinesData = mRes.data || [];
      const commandesData = cRes.data || [];
      const planningData = pRes.data || [];
      console.log("[Planning] fetch sets", {
        machines: machinesData.length,
        commandes: commandesData.length,
        planning: planningData.length,
      });

      setMachines(machinesData);
      setCommandes(commandesData);
      setPlanning(planningData);

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

        if (enCours.length > 1) console.warn("Plusieurs 'En cours' détectées sur une machine.");

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
              (c.duree_totale_heures_minutes ?? c.duree_minutes ?? 0) / 60 ??
              0,
          }))
          .sort(sortByPriority);

        if (queue.length) {
          const q0 = queue[0];
          console.log("[Reflow queue] first item", {
            commandeId: q0.c.id,
            numero: q0.c.numero,
            expectedHours: q0.expectedHours,
            startCursorISO: cursor?.toISOString?.(),
          });
        }

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
        console.log("[Planning] applying updates:", updates.length);
        await Promise.all(updates.map((u) => supabase.from("planning").update(u).eq("id", u.id)));
        const { data: planningAfter } = await supabase.from("planning").select("*");
        setPlanning(planningAfter || []);
        console.log("[Planning] reloaded planning after updates:", planningAfter?.length ?? 0);
      }
    } catch (e) {
      console.error("Erreur updatePlanningHeureParHeure:", e);
    } finally {
      isUpdatingRef.current = false;
      console.log("[Planning] fetchAndReflow: end");
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
      const entry = normalizeSlotForGrid(entryBase);
      if (!acc.has(p.machineId)) acc.set(p.machineId, []);
      acc.get(p.machineId).push(entry);
    }
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
        day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0);
        continue;
      }
      addedBusinessDays++;

      for (let h = 8; h <= 11; h++) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0);
        out.push({ type: "work", label: formatHourRangeFR(start), startTs: start.getTime(), endTs: start.getTime() + ONE_HOUR_MS, dayOfWeek: start.getDay() });
      }

      const lunchStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
      out.push({ type: "lunch", label: `${String(day.getDate()).padStart(2,"0")}/${String(day.getMonth()+1).padStart(2,"0")}/${day.getFullYear()} 12 h - 13 h · Pause déjeuner`, dayOfWeek: lunchStart.getDay() });

      for (let h = 13; h <= 16; h++) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0);
        out.push({ type: "work", label: formatHourRangeFR(start), startTs: start.getTime(), endTs: start.getTime() + ONE_HOUR_MS, dayOfWeek: start.getDay() });
      }

      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0);
    }

    if (!rowsLoggedRef.current) {
      rowsLoggedRef.current = true;
      console.log("[rows] first 6", out.slice(0, 6).map(r => ({
        type: r.type,
        label: r.label,
        startISO: r.startTs ? new Date(r.startTs).toISOString() : null,
        endISO: r.endTs ? new Date(r.endTs).toISOString() : null,
      })));
    }

    return out;
  }, [startDate, HOLIDAYS]);

  /* ---- Utilitaire: intersection case/slot ---- */
  const getIntersectingSlot = (machineId, startTs, endTs) => {
    const arr = planningByMachine.get(machineId);
    if (!arr || arr.length === 0) return null;
    for (const p of arr) {
      if (p.gridStartMs >= endTs) break;
      if (startTs < p.gridEndMs && endTs > p.gridStartMs) return p;
    }
    return null;
  };

  const countDisplayedCellsFor = useCallback(
    (slot) => Math.max(1, workingHoursBetween(slot.debut, slot.fin, workOpts)),
    [workOpts]
  );

  return (
    <div className="planning-page">
      <h2>Planning des machines (vue horaire)</h2>

      <div className="zoom-buttons">
        <button onClick={() => setStartDate(new Date())}>Aujourd’hui</button>
        <button onClick={() => { const prev = new Date(startDate); prev.setDate(prev.getDate() - 14); setStartDate(prev); }}>
          ← Semaine précédente
        </button>
        <button onClick={() => { const next = new Date(startDate); next.setDate(next.getDate() + 14); setStartDate(next); }}>
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
                    <td colSpan={1 + machines.length} className="lunch-separator" title="Pause déjeuner">
                      {row.label}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={rowIndex}>
                  <td className={["time-cell", row.dayOfWeek % 2 === 0 ? "time-cell--even" : "time-cell--odd", row.startTs < Date.now() ? "time-cell--past" : ""].join(" ").trim()}>
                    {row.label}
                  </td>

                  {machines.map((machine) => {
                    const slot = getIntersectingSlot(machine.id, row.startTs, row.endTs);
                    const commande = slot ? commandeById.get(slot.commandeId) : null;

                    const estDepassee = slot && commande && new Date(slot.fin) > new Date(commande.dateLivraison);
                    const urgence = estDepassee ? 5 : (commande ? computeUrgency(commande.dateLivraison) : 1);
                    const coloredCells = slot ? countDisplayedCellsFor(slot) : null;

                    const expectedHours = commande
                      ? Math.max(1, Math.ceil(Number(commande.duree_totale_heures_arrondie ?? commande.duree_totale_heures ?? 0)))
                      : null;

                    const isFirstCell =
                      !!slot && row.startTs <= slot.gridStartMs && row.endTs > slot.gridStartMs;

                    if (slot && commande && isFirstCell) {
                      console.log("[FirstCell] expectedHours calc inputs", {
                        duree_totale_heures_arrondie: commande.duree_totale_heures_arrondie,
                        duree_totale_heures: commande.duree_totale_heures,
                        duree_totale_heures_minutes: commande.duree_totale_heures_minutes,
                        duree_minutes: commande.duree_minutes,
                      });

                      console.groupCollapsed(
                        `[Cell First] machine=${machine.nom} cmd=#${commande.numero} row=${new Date(row.startTs).toISOString()}`
                      );
                      console.log("expectedHours", expectedHours);
                      console.log("coloredCells(from workingHoursBetween)", coloredCells);
                      console.log("slot.debut/fin (raw)", slot.debut, slot.fin);
                      console.log("slot.gridStartMs/gridEndMs", new Date(slot.gridStartMs).toISOString(), new Date(slot.gridEndMs).toISOString());
                      console.log("row.startTs/endTs", new Date(row.startTs).toISOString(), new Date(row.endTs).toISOString());
                      console.log("commande.dateLivraison", commande.dateLivraison);
                      console.groupEnd();
                    }

                    return (
                      <td
                        key={`${machine.id}_${rowIndex}_${slot ? "busy" : "free"}`} // 🔧 remount si switch busy/free
                        className={`cell ${slot ? "cell--busy" : "cell--free"}`}
                        onClick={() => {
                          if (commande) {
                            console.log("🖱️ click cellule", { id: commande.id, statut: commande.statut });
                            setModalCommande(commande);
                          }
                        }}
                        // 🔧 aucune propriété border* inline — seulement des variables CSS
                        style={{
                          "--urgency-color": slot ? urgencyColors[urgence] : "#ddd",
                          "--busy-left-w": slot ? "6px" : "1px",
                          "--cell-bg": slot && commande ? getColorFromId(commande.id) : "white",
                          // garde-fou anti-HMR :
                          border: undefined,
                          borderLeft: undefined,
                        }}
                        title={
                          slot && commande
                            ? `#${commande.numero} • ${commande.client}${
                                expectedHours != null ? ` • ${expectedHours} h prévues` : ""
                              }`
                            : ""
                        }
                      >
                        {/* 🔧 contenu UNIQUEMENT ICI */}
                        {slot && commande ? (
                          <>
                            <strong>#{commande.numero}</strong><br />
                            {commande.client}
                            {isFirstCell && expectedHours != null && (
                              <div className="cell__progress">{coloredCells}/{expectedHours} h</div>
                            )}
                            {estDepassee && <div className="cell__late">⚠️ Fin au-delà de la date</div>}
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

      {modalCommande && (console.log("🧩 Render CommandeModal avec props", {
        id: modalCommande.id,
        statut: modalCommande.statut,
        hasShortenFn: typeof shortenPlanningForCommandeTerminee === "function",
      }), (
        <CommandeModal
          key={`${modalCommande.id}:${modalCommande.statut ?? ""}`}
          commande={modalCommande}
          onClose={() => setModalCommande(null)}
          onOptimisticReplace={replaceCommandeLocal}
          onTermineeShortenPlanning={shortenPlanningForCommandeTerminee}
        />
      ))}
    </div>
  );
}
