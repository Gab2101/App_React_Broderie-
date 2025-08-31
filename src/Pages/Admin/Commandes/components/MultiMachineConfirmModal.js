// src/Pages/Admin/Commandes/components/MultiMachineConfirmModal.js
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { roundMinutesTo5, computeProvisionalEnd } from "../utils/timeRealtime";
import { calculerDurees } from "../../../../utils/calculs";
import { computeNettoyageSecondsForOrder } from "../../../../utils/nettoyageRules";
import { parseLocalDatetime, toUTCISOString, snapToNextWorkStart, addMinutesWithinWorkHours, DEFAULT_WORKDAY } from "../utils/workhours";

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

  // Coefficient de temps supplémentaire (slider)
  const [timeCoefficient, setTimeCoefficient] = useState(confirmCoef);

  // Reset when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setAssignedMachines(new Map());
    setQuery("");
    setTimeCoefficient(confirmCoef);
  }, [isOpen, confirmCoef]);

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

  // Fonction de répartition automatique équitable
  const distributeArticlesEqually = useCallback((selectedMachineIds) => {
    if (selectedMachineIds.length === 0) return new Map();
    
    const baseQuantity = Math.floor(totalQty / selectedMachineIds.length);
    const remainder = totalQty % selectedMachineIds.length;
    
    const newAssignments = new Map();
    selectedMachineIds.forEach((machineId, index) => {
      const machine = machines.find(m => String(m.id) === machineId);
      if (machine) {
        // Les premières machines reçoivent +1 article pour gérer le reste
        const quantity = baseQuantity + (index < remainder ? 1 : 0);
        newAssignments.set(machineId, { quantity, machine });
      }
    });
    
    return newAssignments;
  }, [totalQty, machines]);

  const toggle = useCallback((machineId) => {
    setAssignedMachines((prev) => {
      const currentIds = Array.from(prev.keys());
      let newIds;
      
      if (prev.has(machineId)) {
        // Désélectionner la machine
        newIds = currentIds.filter(id => id !== machineId);
      } else {
        // Sélectionner la machine
        newIds = [...currentIds, machineId];
      }
      
      // Redistribuer automatiquement les articles
      return distributeArticlesEqually(newIds);
    });
  }, [distributeArticlesEqually]);

  const handleQuantityChange = useCallback((machineId, newQuantity) => {
    const qty = Math.max(0, parseInt(newQuantity, 10) || 0);
    setAssignedMachines((prev) => {
      const next = new Map(prev);
      const existing = next.get(machineId);
      if (existing) {
        next.set(machineId, { ...existing, quantity: qty });
      }
      return next;
    });
  }, []);

  // Fonction pour redistribuer équitablement
  const redistributeEqually = useCallback(() => {
    const currentIds = Array.from(assignedMachines.keys());
    setAssignedMachines(distributeArticlesEqually(currentIds));
  }, [assignedMachines, distributeArticlesEqually]);

  // Calculate durations for each assigned machine with end times
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

    // Base de temps pour les calculs
    let baseLocal = parseLocalDatetime(plannedStartLocal);
    if (respectWorkHours) {
      baseLocal = snapToNextWorkStart(baseLocal, DEFAULT_WORKDAY);
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
      const withCoef = Math.round((durationTheoreticalMinutes * timeCoefficient) / 100);
      const durationCalcMinutes = roundMinutesTo5(withCoef);

      // Calculate start and end times
      const startTime = baseLocal;
      const { end: endTime } = respectWorkHours
        ? addMinutesWithinWorkHours(startTime, durationCalcMinutes, DEFAULT_WORKDAY)
        : { end: new Date(startTime.getTime() + durationCalcMinutes * 60000) };

      return {
        machineId: String(machine.id),
        machine,
        quantity,
        durationTheoreticalMinutes,
        durationCalcMinutes,
        cleaningMinutes: cleanPerItemUsed * quantity,
        durationHours: durationCalcMinutes / 60,
        startTime,
        endTime,
        percentage: totalQty > 0 ? Math.round((quantity / totalQty) * 100) : 0,
      };
    });

    const totalMinutes = calculatedRows.reduce((sum, r) => sum + r.durationCalcMinutes, 0);
    const totalHours = totalMinutes / 60;

    return { rows: calculatedRows, totalHours, errorText: null };
  }, [assignedMachines, totalQty, points, vitesseInput, cleanPerItemUsed, timeCoefficient, plannedStartLocal, respectWorkHours]);

  const submit = () => {
    if (errorText || rows.length === 0) return;

    const perMachine = rows.map((r) => ({
      machineId: r.machineId,
      quantity: r.quantity,
      durationTheoreticalMinutes: r.durationTheoreticalMinutes,
      durationCalcMinutes: r.durationCalcMinutes,
      planned_start_iso_utc: toUTCISOString(r.startTime),
      planned_end_iso_utc: toUTCISOString(r.endTime),
    }));

    onConfirm?.({
      perMachine,
      meta: {
        commandeId: formData?.id,
        selectedMachines: Array.from(assignedMachines.keys()),
        coefPercent: timeCoefficient,
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
      <div className="modal" style={{ maxWidth: 1100 }}>
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
                <label style={{ fontSize: 12, opacity: 0.8 }}>Coefficient temps (%)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input 
                    type="range"
                    min={50} 
                    max={500} 
                    step={5}
                    value={timeCoefficient}
                    onChange={(e) => setTimeCoefficient(parseInt(e.target.value, 10))}
                    style={{ flex: 1 }}
                  />
                  <input 
                    type="number" 
                    min={50} 
                    max={500} 
                    step={5}
                    value={timeCoefficient} 
                    onChange={(e) => setTimeCoefficient(Math.max(50, Math.min(500, parseInt(e.target.value, 10) || 100)))}
                    style={{ ...inputStyle, width: 80, textAlign: "center" }}
                  />
                  <span style={{ fontSize: 12 }}>%</span>
                </div>
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
                  <span style={{ fontSize: 11, opacity: 0.7, marginLeft: "auto" }}>
                    {opt.machine.nbTetes} têtes
                  </span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>
                Aucune machine trouvée.
              </div>
            )}
          </div>

          {/* Selected machines with quantity inputs and end times */}
          {assignedMachines.size > 0 && (
            <div style={{ 
              border: "1px solid #e3e3e3", 
              borderRadius: 10, 
              padding: 12, 
              background: "#fff" 
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>Machines sélectionnées</h4>
                <button 
                  type="button"
                  onClick={redistributeEqually}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #007BFF",
                    background: "#fff",
                    color: "#007BFF",
                    cursor: "pointer"
                  }}
                >
                  Redistribuer équitablement
                </button>
              </div>
              
              <div style={{ display: "grid", gap: 8 }}>
                {Array.from(assignedMachines.entries()).map(([machineId, item]) => {
                  const rowData = rows.find(r => r.machineId === machineId);
                  return (
                    <div key={machineId} style={{ 
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 2fr 2fr",
                      gap: 12,
                      alignItems: "center",
                      padding: "12px",
                      border: "1px solid #f0f0f0",
                      borderRadius: 8,
                      background: "#fafafa"
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.machine.nom}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {item.machine.nbTetes} têtes • {rowData?.percentage || 0}% du total
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 12, opacity: 0.8 }}>Quantité:</label>
                        <input
                          type="number"
                          min={0}
                          max={totalQty}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(machineId, e.target.value)}
                          style={{ ...inputStyle, width: 60, textAlign: "center" }}
                        />
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {rowData ? `${rowData.durationHours.toFixed(1)}h` : "—"}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          ({rowData?.durationCalcMinutes || 0} min)
                        </div>
                      </div>

                      <div style={{ fontSize: 12 }}>
                        <div><strong>Début:</strong></div>
                        <div style={{ opacity: 0.8 }}>
                          {rowData?.startTime ? 
                            rowData.startTime.toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit", 
                              hour: "2-digit",
                              minute: "2-digit"
                            }) : "—"
                          }
                        </div>
                      </div>

                      <div style={{ fontSize: 12 }}>
                        <div><strong>Fin estimée:</strong></div>
                        <div style={{ opacity: 0.8, color: "#007BFF", fontWeight: 500 }}>
                          {rowData?.endTime ? 
                            rowData.endTime.toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit", 
                              hour: "2-digit",
                              minute: "2-digit"
                            }) : "—"
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results summary */}
          {errorText ? (
            <div style={{ color: "#c62828", fontSize: 13, padding: 8, background: "#ffebee", borderRadius: 8 }}>
              ⚠️ {errorText}
            </div>
          ) : (
            rows.length > 0 && (
              <div style={{ 
                border: "1px dashed #e3e3e3", 
                borderRadius: 10, 
                padding: 12,
                background: "#f9f9f9"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>
                    Durée totale estimée : {totalHours.toFixed(2)} h
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Coefficient appliqué : {timeCoefficient}%
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Machine
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Qté (%)
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Durée (h)
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Calc. (min)
                        </th>
                        <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                          Fin estimée
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
                            {r.quantity} ({r.percentage}%)
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px" }}>
                            {r.durationHours.toFixed(2)}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px" }}>
                            {r.durationCalcMinutes}
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px", fontSize: 12 }}>
                            {r.endTime.toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
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
            Valider ({assignedMachines.size} machine{assignedMachines.size > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}