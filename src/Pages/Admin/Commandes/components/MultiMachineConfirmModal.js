// src/Pages/Admin/Commandes/components/MultiMachineConfirmModal.js
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { roundMinutesTo5, computeProvisionalEnd } from "../utils/timeRealtime";
import { calculerDurees } from "../../../../utils/calculs";
import { computeNettoyageSecondsForOrder } from "../../../../utils/nettoyageRules";

export default function MultiMachineConfirmModal({
  isOpen,
  onClose,
  machines = [],
  formData,
  nettoyageRules = [],
  articleTags = [],
  confirmCoef = 100,
  onConfirm,
}) {
  const [query, setQuery] = useState("");
  const [assignedMachines, setAssignedMachines] = useState(new Map()); // machineId -> { quantity, machine }
  
  // Planification
  const [plannedStartLocal, setPlannedStartLocal] = useState(() =>
    new Date().toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
  );
  const [respectWorkHours, setRespectWorkHours] = useState(true);

  // Reset when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setAssignedMachines(new Map());
    setQuery("");
  }, [isOpen]);

  const totalQty = Math.max(0, Number(formData?.quantite || 0));
  const points = Math.max(0, Number(formData?.points || 0));
  const vitesseInput = Number(formData?.vitesseMoyenne || 680);

  // Calculate cleaning time per item based on selected article and options
  const cleanPerItemUsed = useMemo(() => {
    const etiquetteArticle = formData?.types?.[0] || null;
    const nettoyageParArticleSec = computeNettoyageSecondsForOrder(
      etiquetteArticle,
      formData?.options || [],
      nettoyageRules,
      articleTags
    );
    return Math.round(nettoyageParArticleSec / 60); // convert to minutes
  }, [formData, nettoyageRules, articleTags]);

  const options = useMemo(
    () =>
      machines.map((m) => ({
        value: String(m.id),
        label: m.nom ?? `Machine ${m.id}`,
        machine: m,
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

  const toggle = useCallback((machineId) => {
    setAssignedMachines((prev) => {
      const next = new Map(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        const machine = machines.find(m => String(m.id) === machineId);
        if (machine) {
          next.set(machineId, { quantity: 1, machine });
        }
      }
      return next;
    });
  }, [machines]);

  const handleQuantityChange = useCallback((machineId, newQuantity) => {
    const qty = Math.max(1, parseInt(newQuantity, 10) || 1);
    setAssignedMachines((prev) => {
      const next = new Map(prev);
      const existing = next.get(machineId);
      if (existing) {
        next.set(machineId, { ...existing, quantity: qty });
      }
      return next;
    });
  }, []);

  // Calculate durations for each assigned machine
  const { rows, totalHours, errorText } = useMemo(() => {
    const assignedArray = Array.from(assignedMachines.values());
    
    if (assignedArray.length === 0) {
      return { rows: [], totalHours: 0, errorText: "Sélectionnez au moins une machine." };
    }

    const totalAssignedQty = assignedArray.reduce((sum, item) => sum + item.quantity, 0);
    if (totalAssignedQty > totalQty) {
      return {
        rows: [],
        totalHours: 0,
        errorText: `La quantité totale assignée (${totalAssignedQty}) dépasse la quantité de la commande (${totalQty}).`,
      };
    }

    const calculatedRows = assignedArray.map((item) => {
      const machine = item.machine;
      const quantity = item.quantity;

      // Calculate theoretical duration using existing calculation logic
      const nettoyageParArticleSec = cleanPerItemUsed * 60; // convert back to seconds for calculerDurees
      const { dureeTotaleHeures } = calculerDurees({
        quantite: quantity,
        points,
        vitesse: vitesseInput,
        nbTetes: Number(machine.nbTetes || 1),
        nettoyageParArticleSec,
      });

      const durationTheoreticalMinutes = Math.round(dureeTotaleHeures * 60);
      
      // Apply coefficient
      const withCoef = Math.round((durationTheoreticalMinutes * confirmCoef) / 100);
      const durationCalcMinutes = roundMinutesTo5(withCoef);

      return {
        machineId: String(machine.id),
        machine,
        quantity,
        durationTheoreticalMinutes,
        durationCalcMinutes,
        cleaningMinutes: cleanPerItemUsed * quantity,
        durationHours: durationCalcMinutes / 60,
      };
    });

    const totalMinutes = calculatedRows.reduce((sum, r) => sum + r.durationCalcMinutes, 0);
    const totalHours = totalMinutes / 60;

    return { rows: calculatedRows, totalHours, errorText: null };
  }, [assignedMachines, totalQty, points, vitesseInput, cleanPerItemUsed, confirmCoef]);

  const submit = () => {
    if (errorText || rows.length === 0) return;

    const perMachine = rows.map((r) => ({
      machineId: r.machineId,
      quantity: r.quantity,
      durationTheoreticalMinutes: r.durationTheoreticalMinutes,
      durationCalcMinutes: r.durationCalcMinutes,
      planned_start_iso_utc: plannedStartLocal ? new Date(plannedStartLocal).toISOString() : null,
      planned_end_iso_utc: plannedStartLocal ? computeProvisionalEnd(plannedStartLocal, r.durationCalcMinutes) : null,
    }));

    onConfirm?.({
      perMachine,
      meta: {
        commandeId: formData?.id,
        selectedMachines: Array.from(assignedMachines.keys()),
        coefPercent: confirmCoef,
        cleaningPerItemMinutes: cleanPerItemUsed,
        points,
        vitesseMoyenne: vitesseInput,
        quantity: totalQty,
      },
      plannedStartLocal,
      respectWorkHours,
    });
  };

  if (!isOpen) return null;

  const inputStyle = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e3e3e3",
    background: "#fff",
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

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 980 }}>
        <div className="modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Répartition multi-machines</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="modal__body" style={{ display: "grid", gap: 12 }}>
          {/* Search and parameters */}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Rechercher une machine…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ fontSize: 13, opacity: 0.75 }}>
                {assignedMachines.size} sélectionnée(s)
              </span>
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Coef appliqué (%)</label>
                <input 
                  type="number" 
                  min={50} 
                  max={500} 
                  step={5}
                  value={confirmCoef} 
                  disabled 
                  style={inputStyle} 
                />
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Nettoyage par pièce (min)</label>
                <input 
                  type="number" 
                  value={cleanPerItemUsed} 
                  disabled 
                  style={inputStyle} 
                />
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Quantité totale</label>
                <input 
                  type="number" 
                  value={totalQty} 
                  disabled 
                  style={inputStyle} 
                />
              </div>
            </div>
          </div>

          {/* Machine selection list */}
          <div style={{ 
            border: "1px solid #f0f0f0", 
            borderRadius: 10, 
            padding: 8, 
            background: "#fafafa",
            maxHeight: 280, 
            overflow: "auto", 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
            gap: 8 
          }}>
            {filtered.map((opt) => {
              const checked = assignedMachines.has(opt.value);
              return (
                <label key={opt.value} style={cardStyle}>
                  <input 
                    type="checkbox" 
                    checked={checked} 
                    onChange={() => toggle(opt.value)} 
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>
                Aucune machine trouvée.
              </div>
            )}
          </div>

          {/* Selected machines with quantity inputs */}
          {assignedMachines.size > 0 && (
            <div style={{ 
              border: "1px solid #e3e3e3", 
              borderRadius: 10, 
              padding: 12, 
              background: "#fff" 
            }}>
              <h4 style={{ margin: "0 0 12px 0" }}>Machines sélectionnées</h4>
              
              <div style={{ display: "grid", gap: 8 }}>
                {Array.from(assignedMachines.entries()).map(([machineId, item]) => (
                  <div key={machineId} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 12, 
                    padding: "8px 12px",
                    border: "1px solid #f0f0f0",
                    borderRadius: 8,
                    background: "#fafafa"
                  }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>
                      {item.machine.nom}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: 12, opacity: 0.8 }}>Quantité:</label>
                      <input
                        type="number"
                        min={1}
                        max={totalQty}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(machineId, e.target.value)}
                        style={{ ...inputStyle, width: 80, textAlign: "center" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results summary */}
          {errorText ? (
            <div style={{ color: "#c62828", fontSize: 13, padding: 8 }}>{errorText}</div>
          ) : (
            rows.length > 0 && (
              <div style={{ 
                border: "1px dashed #e3e3e3", 
                borderRadius: 10, 
                padding: 12,
                background: "#f9f9f9"
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Durée totale estimée : {totalHours.toFixed(2)} h
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Machine
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Qté
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Durée (h)
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Calc. (min)
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Théo. (min)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.machineId}>
                          <td style={{ textAlign: "left", padding: "6px 8px" }}>
                            {r.machine.nom || r.machineId}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px" }}>
                            {r.quantity}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px" }}>
                            {r.durationHours.toFixed(2)}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px" }}>
                            {r.durationCalcMinutes}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px" }}>
                            {Math.round(r.durationTheoreticalMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Planning section */}
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
              Respecter les heures ouvrées (08:00–17:00, sans week-end)
            </label>
          </div>
        </div>

        <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8 }}>
            Annuler
          </button>
          <button 
            onClick={submit} 
            disabled={assignedMachines.size === 0 || !!errorText}
            style={{ 
              padding: "8px 16px", 
              borderRadius: 8, 
              backgroundColor: assignedMachines.size === 0 || !!errorText ? "#ccc" : "#28a745",
              color: "#fff",
              border: "none"
            }}
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}