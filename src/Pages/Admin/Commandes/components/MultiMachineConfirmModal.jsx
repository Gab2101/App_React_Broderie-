import React, { useState, useEffect, useMemo } from "react";

const inputStyle = { border: "1px solid #ccc", borderRadius: 4, padding: "4px 8px", fontSize: 12 };
const panelStyle = { border: "1px solid #e3e3e3", borderRadius: 8, padding: 12, backgroundColor: "#fafafa" };
const cardStyle = { display: "flex", alignItems: "center", gap: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6, backgroundColor: "white" };

export default function MultiMachineConfirmModal({
  isOpen,
  onClose,
  commande,
  machines,
  onConfirm,
  preview
}) {
  const [selected, setSelected] = useState(new Set());
  const [effUsed, setEffUsed] = useState(100);
  const [coefUsed, setCoefUsed] = useState(100);
  const [cleanPerItemUsed, setCleanPerItemUsed] = useState(0);
  const [cleanBatchUsed, setCleanBatchUsed] = useState(0);
  const [cleaningMode, setCleaningMode] = useState("per_item");
  const [roundingMode, setRoundingMode] = useState("round");
  const [startDate, setStartDate] = useState("");
  const [planified, setPlanified] = useState(false);

  const filtered = useMemo(() => {
    return machines.filter(m => m.nom.toLowerCase().includes(""));
  }, [machines]);

  const checked = (id) => selected.has(id);
  const toggle = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const rows = useMemo(() => {
    if (!preview?.rows) return [];
    return preview.rows.filter(r => selected.has(r.machineId));
  }, [preview?.rows, selected]);

  const totalHours = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.durationHours, 0);
  }, [rows]);

  const labelById = useMemo(() => {
    const map = new Map();
    machines.forEach(m => map.set(String(m.id), m.nom));
    return map;
  }, [machines]);

  const errorText = selected.size === 0 ? "Sélectionnez au moins une machine" : null;

  const submit = () => {
    if (selected.size === 0) return;
    onConfirm({
      machineIds: Array.from(selected),
      startDate: planified ? startDate : null,
      coef: coefUsed
    });
  };

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      setEffUsed(100);
      setCoefUsed(100);
      setCleanPerItemUsed(0);
      setCleanBatchUsed(0);
      setCleaningMode("per_item");
      setRoundingMode("round");
      setStartDate("");
      setPlanified(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
                placeholder="Filtrer machines..."
                style={{ flex: 1, ...inputStyle }}
              />
              <span style={{ fontSize: 13, opacity: 0.75 }}>{selected.size} sélectionnée(s)</span>
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
              return (
                <label key={opt.id} style={cardStyle}>
                  <input type="checkbox" checked={checked(opt.id)} onChange={() => toggle(opt.id)} />
                  <span>{opt.nom}</span>
                </label>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>Aucune machine.</div>}
          </div>

          {errorText ? (
            <div style={{ color: "#c62828", fontSize: 13 }}>{errorText}</div>
          ) : (
            selected.size > 0 && rows.length > 0 && (
              <div style={{ border: "1px dashed #e3e3e3", borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  Durée totale (somme + batch) : {totalHours.toFixed(2)} h
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
                    {rows.map((r) => (
                      <tr key={r.machineId}>
                        <td style={{ textAlign: "left" }}>{labelById.get(String(r.machineId)) || r.machineId}</td>
                        <td style={{ textAlign: "center" }}>{r.quantity}</td>
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
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={!planified}
              style={{ ...inputStyle, width: "100%" }}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
              <input
                type="checkbox"
                checked={planified}
                onChange={(e) => setPlanified(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>Planifier immédiatement</span>
            </label>
          </div>
        </div>

        <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose}>Annuler</button>
          <button onClick={submit} disabled={selected.size === 0 || !!errorText}>Valider</button>
        </div>
      </div>
    </div>
  );
}
