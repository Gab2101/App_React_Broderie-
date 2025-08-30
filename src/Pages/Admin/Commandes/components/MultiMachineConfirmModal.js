// src/Pages/Admin/Commandes/components/MultiMachineConfirmModal.js
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { roundMinutesTo5, computeProvisionalEnd } from "../utils/timeRealtime";

export default function MultiMachineConfirmModal({
  isOpen,
  onClose,
  machines = [],
  // Données de base (issues du form principal)
  formData, // attendu: { id, quantite, points, vitesseMoyenne }
  // Coef (%) appliqué comme dans le mono (ex: confirmCoef du modal2)
  confirmCoef = 100,

  // Sélection par défaut
  defaultSelected = [],

  // Options calcul (mêmes règles que mono)
  roundingMode = "ceil5",                 // on utilise l'arrondi 5 min par défaut
  efficacitePercent = 100,
  extraPercent = 0,                        // marge additionnelle SI tu veux la distinguer du coef (sinon mets 0)
  cleaningMode = "per_item",               // "per_item" | "per_batch"
  cleaningPerItemMinutes = 0,
  cleaningBatchMinutes = 0,

  // Sortie
  onConfirm, // ({ assignations, meta, plannedStartLocal, respectWorkHours, flow: "multi" })
}) {
  // ---------------- State & Helpers ----------------
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => defaultSelected.map(String));

  // Planification (remplace l'ancien MultiMachineConfirmModal)
  const [plannedStartLocal, setPlannedStartLocal] = useState(() =>
    new Date().toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
  );
  const [respectWorkHours, setRespectWorkHours] = useState(true);

  // État pour la gestion manuelle des quantités
  const [currentRows, setCurrentRows] = useState([]);
  const [currentTotalHours, setCurrentTotalHours] = useState(0);
  const [currentErrorText, setCurrentErrorText] = useState(null);

  // Réinit à l'ouverture
  useEffect(() => {
    if (!isOpen) return;
    setSelected(defaultSelected.map(String));
  }, [isOpen, defaultSelected]);

  const commandeId = formData?.id ?? null;
  const totalQty = Math.max(0, Number(formData?.quantite || 0));
  const points = Math.max(0, Number(formData?.points || 0));
  const vitesseInput = Number(formData?.vitesseMoyenne || 0);

  const effUsed = Math.max(1, Number(efficacitePercent) || 100); // évite /0
  const extraUsed = Math.max(0, Number(extraPercent) || 0);      // marge additionnelle
  const coefUsed = Math.max(50, Math.min(500, Number(confirmCoef || 100))); // % appliqué comme mono
  const cleanPerItemUsed = Math.max(0, Number(cleaningPerItemMinutes) || 0);
  const cleanBatchUsed = Math.max(0, Number(cleaningBatchMinutes) || 0);

  const labelById = useMemo(() => {
    const map = new Map();
    machines.forEach((m) => map.set(String(m.id), m.nom ?? `Machine ${m.id}`));
    return map;
  }, [machines]);

  const options = useMemo(
    () =>
      machines.map((m) => ({
        value: String(m.id),
        label: m.nom ?? `Machine ${m.id}`,
        tags: Array.isArray(m.etiquettes) ? m.etiquettes.join(" ").toLowerCase() : "",
      })),
    [machines]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.tags.includes(q)
    );
  }, [options, query]);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Normalisation de la vitesse comme dans nos règles mono
  const normalizeSpeedPtsPerMin = (v) => {
    let s = Number(v) || 0;
    if (s <= 0) return 600;       // plancher safe
    if (s > 10000) s = s / 60;    // saisi en points/HEURE
    return s;
  };

  // Répartition équitable (ex: 11 sur 3 -> [4,4,3])
  const splitEven = (total, n) => {
    const t = parseInt(total || "0", 10);
    if (!Number.isFinite(t) || t < 0 || !Number.isInteger(n) || n <= 0) return [];
    const base = Math.floor(t / n);
    let rest = t % n;
    const arr = new Array(n).fill(base);
    for (let i = 0; i < n && rest > 0; i++) {
      arr[i] += 1;
      rest--;
    }
    return arr;
  };

  // Calcule théorie d'une sous-qté (sans batch global)
  const computeTheoMinutes = useCallback(
    (qty) => {
      const q = Math.max(0, Number(qty) || 0);
      const ptsPerItem = Math.max(0, Number(points) || 0);
      const speed = normalizeSpeedPtsPerMin(vitesseInput);
      const theoretical = (ptsPerItem * q) / speed; // minutes

      // efficacité (%): si 80 => x (100/80)
      const effAdjusted = theoretical * (100 / effUsed);

      // extra% additionnel (business) si tu le distingues du coef (sinon laisse 0)
      const withExtra = effAdjusted * (1 + extraUsed / 100);

      // nettoyage per_item uniquement ici (le per_batch sera géré UNE fois plus bas)
      const cleaningItem = cleaningMode === "per_item" ? cleanPerItemUsed * q : 0;

      return Math.max(0, withExtra + cleaningItem);
    },
    [points, vitesseInput, effUsed, extraUsed, cleaningMode, cleanPerItemUsed]
  );

  // Arrondi helper (on garde roundTo5 comme dans modal2)
  const applyRounding = useCallback((m) => {
    const minutes = Math.max(0, Number(m) || 0);
    if (roundingMode === "ceil15") return Math.ceil(minutes / 15) * 15;
    if (roundingMode === "ceil5")  return Math.ceil(minutes / 5)  * 5;
    return roundMinutesTo5(Math.round(minutes));
  }, [roundingMode]);

  // Initialisation des lignes quand les machines sélectionnées changent
  useEffect(() => {
    if (!selected.length) {
      setCurrentRows([]);
      setCurrentTotalHours(0);
      setCurrentErrorText("Sélectionnez au moins une machine.");
      return;
    }

    if (totalQty < selected.length) {
      setCurrentRows([]);
      setCurrentTotalHours(0);
      setCurrentErrorText(`La quantité (${totalQty}) doit être ≥ au nombre de machines sélectionnées (${selected.length}).`);
      return;
    }

    // Répartition équitable initiale
    const shares = splitEven(totalQty, selected.length);
    const initialRows = selected.map((mid, i) => {
      const q = shares[i];
      const theoMinutes = computeTheoMinutes(q);
      const withCoef = Math.round((theoMinutes * coefUsed) / 100);
      const durationCalcMinutes = applyRounding(withCoef);

      return {
        machineId: mid,
        quantity: q,
        durationTheoreticalMinutes: theoMinutes,
        durationCalcMinutes,
        cleaningMinutes: cleaningMode === "per_item" ? cleanPerItemUsed * q : 0,
        durationHours: durationCalcMinutes / 60,
      };
    });

    setCurrentRows(initialRows);
    
    // Calcul du total avec batch cleaning
    const batchMinutes = cleaningMode === "per_batch" ? cleanBatchUsed : 0;
    const minutesSum = initialRows.reduce((s, r) => s + r.durationCalcMinutes, 0) + batchMinutes;
    setCurrentTotalHours(minutesSum / 60);
    setCurrentErrorText(null);
  }, [selected, totalQty, computeTheoMinutes, coefUsed, applyRounding, cleaningMode, cleanPerItemUsed, cleanBatchUsed]);

  // Gestion du changement de quantité pour une machine
  const handleQuantityChange = useCallback((machineId, newQuantity) => {
    const qty = Math.max(0, parseInt(newQuantity || "0", 10));
    
    setCurrentRows(prev => {
      const updated = prev.map(row => {
        if (row.machineId !== machineId) return row;
        
        // Recalculer les durées pour cette machine avec la nouvelle quantité
        const theoMinutes = computeTheoMinutes(qty);
        const withCoef = Math.round((theoMinutes * coefUsed) / 100);
        const durationCalcMinutes = applyRounding(withCoef);
        
        return {
          ...row,
          quantity: qty,
          durationTheoreticalMinutes: theoMinutes,
          durationCalcMinutes,
          cleaningMinutes: cleaningMode === "per_item" ? cleanPerItemUsed * qty : 0,
          durationHours: durationCalcMinutes / 60,
        };
      });

      // Recalculer le total et vérifier les erreurs
      const sumQuantities = updated.reduce((s, r) => s + r.quantity, 0);
      const batchMinutes = cleaningMode === "per_batch" ? cleanBatchUsed : 0;
      const minutesSum = updated.reduce((s, r) => s + r.durationCalcMinutes, 0) + batchMinutes;
      
      setCurrentTotalHours(minutesSum / 60);
      
      if (sumQuantities > totalQty) {
        setCurrentErrorText(`La somme des quantités (${sumQuantities}) dépasse la quantité totale de la commande (${totalQty}).`);
      } else if (sumQuantities === 0) {
        setCurrentErrorText("Au moins une machine doit avoir une quantité > 0.");
      } else {
        setCurrentErrorText(null);
      }

      return updated;
    });
  }, [computeTheoMinutes, coefUsed, applyRounding, cleaningMode, cleanPerItemUsed, cleanBatchUsed, totalQty]);

  // ----- Construction des assignations prêtes DB -----
  const buildAssignations = useCallback(() => {
    if (!commandeId) return [];
    if (!currentRows.length) return [];

    // Répartition du batch cleaning : on l'attache à la première ligne (documenté)
    const batchMinutes = cleaningMode === "per_batch" ? cleanBatchUsed : 0;

    const startISO = plannedStartLocal ? new Date(plannedStartLocal).toISOString() : null;

    return currentRows.map((r, idx) => {
      // cleaning par ligne = per_item déjà compté dans les théories ci-dessus,
      // + batch UNE SEULE FOIS sur la première ligne :
      const cleaning_minutes = (cleaningMode === "per_item" ? (cleanPerItemUsed * r.quantity) : 0)
        + (idx === 0 ? batchMinutes : 0);

      // planned_end = start + durée (par ligne)
      const planned_start = startISO;
      const planned_end = planned_start
        ? computeProvisionalEnd(planned_start, r.durationCalcMinutes + (idx === 0 ? batchMinutes : 0))
        : null;

      return {
        commande_id: commandeId,
        machine_id: r.machineId,
        qty: r.quantity,
        duration_minutes: Math.round(r.durationTheoreticalMinutes), // théorie (avant coef/arrondi)
        duration_calc_minutes: r.durationCalcMinutes + (idx === 0 ? batchMinutes : 0), // après coef/arrondi + batch une fois
        cleaning_minutes,
        extra_percent: Math.max(0, coefUsed - 100),                  // on stocke le % appliqué au même endroit
        planned_start,                                               // ISO ou null
        planned_end,                                                 // ISO ou null
        status: "A commencer",
      };
    });
  }, [
    currentRows,
    commandeId,
    plannedStartLocal,
    cleaningMode,
    cleanPerItemUsed,
    cleanBatchUsed,
    coefUsed,
  ]);

  const submit = () => {
    if (currentErrorText) return;

    const assignations = buildAssignations();

    onConfirm?.({
      assignations,
      meta: {
        commandeId,
        selectedMachines: selected.slice(),
        efficiencyPercent: effUsed,
        extraPercent: extraUsed,
        coefPercent: coefUsed,
        cleaningMode,
        cleaningPerItemMinutes: cleanPerItemUsed,
        cleaningBatchMinutes: cleanBatchUsed,
        roundingMode,
        points,
        vitesseMoyenne: vitesseInput,
        quantity: totalQty,
      },
      plannedStartLocal,
      respectWorkHours,
      flow: "multi",
    });
  };

  if (!isOpen) return null;

  // ---------- UI ----------
  const panelStyle = {
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 8,
    background: "#fafafa",
  };

  const cardStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #eaeaea",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#fff",
    cursor: "pointer",
  };

  const inputStyle = {
    flex: 1,
    minWidth: 0,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e3e3e3",
    background: "#fff",
  };

  const quantityInputStyle = {
    width: "80px",
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #e3e3e3",
    textAlign: "center",
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 980 }}>
        <div className="modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Répartition multi-machines</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="modal__body" style={{ display: "grid", gap: 12 }}>
          {/* Filtres & paramètres */}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Rechercher une machine…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 13, opacity: 0.75 }}>{selected.length} sélectionnée(s)</span>
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Efficacité (%)</label>
                <input type="number" min={1} max={500} step={1}
                  value={effUsed} onChange={() => {}} disabled style={inputStyle} />
                <small style={{opacity:0.6}}>Fixé par le form (même règle que mono)</small>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Coef réel appliqué (%)</label>
                <input type="number" min={50} max={500} step={5}
                  value={coefUsed} onChange={() => {}} disabled style={inputStyle} />
                <small style={{opacity:0.6}}>Même logique que le mono (modal2)</small>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Nettoyage par pièce (min)</label>
                <input type="number" min={0} max={600} step={1}
                  value={cleanPerItemUsed} onChange={() => {}} disabled style={inputStyle} />
                <small style={{opacity:0.6}}>Le lot (batch) sera ajouté une fois</small>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Nettoyage par lot (min)</label>
                <input type="number" min={0} max={600} step={1}
                  value={cleanBatchUsed} onChange={() => {}} disabled style={inputStyle} />
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Mode de nettoyage</label>
                <input value={cleaningMode} onChange={() => {}} disabled style={inputStyle} />
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Arrondi</label>
                <input value={roundingMode} onChange={() => {}} disabled style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Liste des machines */}
          <div style={{ ...panelStyle, maxHeight: 280, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {filtered.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label key={opt.value} style={cardStyle}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)} />
                  <span>{opt.label}</span>
                </label>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>Aucune machine.</div>}
          </div>

          {/* Récap résultats avec édition des quantités */}
          {currentErrorText ? (
            <div style={{ color: "#c62828", fontSize: 13 }}>{currentErrorText}</div>
          ) : (
            selected.length > 0 && currentRows.length > 0 && (
              <div style={{ border: "1px dashed #e3e3e3", borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  Durée totale (somme + batch) : {currentTotalHours.toFixed(2)} h
                </div>
                <div style={{ fontSize: 13, marginBottom: 8, opacity: 0.7 }}>
                  Quantité totale assignée : {currentRows.reduce((s, r) => s + r.quantity, 0)} / {totalQty}
                </div>

                <table className="mini" style={{ width: "100%", fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Machine</th>
                      <th>Qté</th>
                      <th>Durée (h)</th>
                      <th>Durée calc. (min)</th>
                      <th>Théorique (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((r) => (
                      <tr key={r.machineId}>
                        <td style={{ textAlign: "left" }}>{labelById.get(String(r.machineId)) || r.machineId}</td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="number"
                            min="0"
                            max={totalQty}
                            value={r.quantity}
                            onChange={(e) => handleQuantityChange(r.machineId, e.target.value)}
                            style={quantityInputStyle}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>{r.durationHours.toFixed(2)}</td>
                        <td style={{ textAlign: "center" }}>{r.durationCalcMinutes}</td>
                        <td style={{ textAlign: "center" }}>{Math.round(r.durationTheoreticalMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Planification */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>Début planifié</label>
            <input
              type="datetime-local"
              value={plannedStartLocal}
              onChange={(e) => setPlannedStartLocal(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e3e3e3", background: "#fff" }}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
              <input
                type="checkbox"
                checked={respectWorkHours}
                onChange={(e) => setRespectWorkHours(e.target.checked)}
              />
              Respecter les heures ouvrées (08:00–18:00, sans week-end)
            </label>
          </div>
        </div>

        <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose}>Annuler</button>
          <button onClick={submit} disabled={selected.length === 0 || !!currentErrorText}>Valider</button>
        </div>
      </div>
    </div>
  );
}