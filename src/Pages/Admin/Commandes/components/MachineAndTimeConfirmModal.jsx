import React, { useState, useEffect } from "react";
import { convertHoursToHHMM } from "@/utils/time.js";

const clampPercentToStep5 = (value) => Math.round(value / 5) * 5;

export default function MachineAndTimeConfirmModal({
  isOpen,
  onClose,
  commande,
  machineOptions,
  onConfirm,
  preview,
  finEstimee
}) {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [confirmCoef, setConfirmCoef] = useState(100);

  useEffect(() => {
    if (isOpen && machineOptions.length > 0) {
      setSelectedMachine(machineOptions[0]?.m || null);
      setConfirmCoef(100);
    }
  }, [isOpen, machineOptions]);

  if (!isOpen) return null;

  const neededTypes = Array.isArray(commande?.types) ? commande.types : [];
  const isMono = !commande?.multiMachine;

  const handleConfirm = () => {
    if (!selectedMachine) return;
    onConfirm(selectedMachine.id, confirmCoef);
  };

  return (
    <div className="modal__backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal__header">
          <h3>Confirmer machine & durée</h3>
          <button className="btn-fermer" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="modal__content">
          <div className="muted" style={{ marginBottom: 8 }}>
            Types d'article : {neededTypes.length ? neededTypes.join(" • ") : "—"}
          </div>

          {/* Réglage du % appliqué (UNIQUEMENT broderie) */}
          <div style={{ marginTop: 8 }}>
            <label>
              Coefficient broderie (%)
              <input
                type="range"
                min="50"
                max="500"
                step="5"
                value={confirmCoef}
                onChange={(e) => setConfirmCoef(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>50%</span><strong>{clampPercentToStep5(Number(confirmCoef || 100))}%</strong><span>500%</span>
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              (Le pourcentage s'applique uniquement au temps de <strong>broderie</strong>. Le <em>nettoyage</em> reste inchangé.)
            </div>
          </div>

          {isMono && (
            <div style={{ marginTop: 12 }}>
              <label>
                Nombre d'unités mono utilisées en parallèle
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={1}
                  disabled
                  style={{ width: "60px", marginLeft: 8 }}
                />
              </label>
              <div className="muted" style={{ marginTop: 4 }}>
                La broderie théorique est divisée par ce nombre. Le nettoyage n'est pas modifié.
              </div>
            </div>
          )}

          {/* Récap' durée (théorique vs appliquée) */}
          <div style={{ marginTop: 12, padding: 8, border: "1px solid #eee", borderRadius: 8 }}>
            <div><strong>Broderie (théorique adj.)</strong> : {preview.broderieTheoAdj} min</div>
            <div><strong>Nettoyage (théorique)</strong> : {preview.nettoyageApplique} min</div>
            <div><strong>Total théorique</strong> : {preview.totalTheoAdj} min ({convertHoursToHHMM(preview.totalTheoAdj / 60)})</div>
            <hr />
            <div><strong>Broderie appliquée</strong> : {preview.broderieAppliquee} min</div>
            <div><strong>Total appliqué</strong> : {preview.totalApplique} min ({convertHoursToHHMM(preview.totalApplique / 60)})</div>
            {finEstimee && <div className="muted">Fin estimée : {finEstimee}</div>}
          </div>

          {/* Choix de la machine avec ETA par option */}
          <div style={{ marginTop: 12 }}>
            <label>
              Machine
              <select
                value={selectedMachine?.id ?? ""}
                onChange={(e) => {
                  const machine = machineOptions.find(opt => opt.m.id === e.target.value)?.m;
                  setSelectedMachine(machine || null);
                }}
                style={{ width: "100%", marginTop: 4 }}
              >
                {machineOptions.map(({ m, label }) => (
                  <option key={m.id} value={m.id}>{label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose}>Annuler</button>
          <button onClick={handleConfirm}>Confirmer ce choix</button>
        </div>
      </div>
    </div>
  );
}
