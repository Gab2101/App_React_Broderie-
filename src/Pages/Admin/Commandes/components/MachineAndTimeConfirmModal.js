// src/Pages/Admin/Commandes/components/MachineAndTimeConfirmModal.jsx
import React, { useMemo } from "react";
import { convertHoursToHHMM } from "../../../../utils/time";
import { roundMinutesTo5, clampPercentToStep5, computeProvisionalEnd } from "../utils/timeRealtime";
import { toLabelArray } from "../utils/labels";

export default function MachineAndTimeConfirmModal({
  isOpen,
  onClose,
  machines,
  formData,
  selectedScenario,
  scenarioByMachineId,
  currentScenario,
  confirmCoef,
  setConfirmCoef,
  // ⚠️ minutesReellesAppliquees arrive déjà en PROP → ne pas la redéclarer dans ce composant
  minutesReellesAppliquees,
  machineAssignee,
  setMachineAssignee,
  monoUnitsUsed,
  setMonoUnitsUsed,
  onConfirm,
}) {
  // Hooks: toujours au top et jamais dans un if
  const selectedMachine = useMemo(() => {
    const id = machineAssignee ?? selectedScenario?.machine?.id;
    return machines.find((m) => String(m.id) === String(id)) || selectedScenario?.machine || null;
  }, [machines, machineAssignee, selectedScenario]);

  const isMono = useMemo(() => {
    return Number(selectedMachine?.nbTetes || 1) === 1;
  }, [selectedMachine]);

  const neededTypes = useMemo(() => {
    return toLabelArray(formData?.types);
  }, [formData?.types]);

  // On peut retourner null après les hooks (ordre garanti)
  if (!isOpen || !selectedScenario || !selectedMachine) return null;

  const handleConfirm = () => {
    onConfirm({
      machineId: machineAssignee ?? selectedScenario.machine.id,
      coef: confirmCoef,
      monoUnitsUsed: isMono ? Math.max(1, Number(monoUnitsUsed || 1)) : 1,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Confirmer la machine & le temps réel</h2>

        <p>
          <strong>Machine proposée :</strong> {selectedScenario.machine.nom}
        </p>

        <div className="grid-2cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p>
              <strong>Temps broderie (théorique) :</strong>{" "}
              {convertHoursToHHMM(selectedScenario.dureeBroderieHeures)}
            </p>
            <p>
              <strong>Temps nettoyage (théorique) :</strong>{" "}
              {convertHoursToHHMM(selectedScenario.dureeNettoyageHeures)}
            </p>
            <p>
              <strong>Temps total (théorique) :</strong>{" "}
              {convertHoursToHHMM(selectedScenario.dureeTotaleHeuresReelle)}
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Pourcentage appliqué (temps réel)</label>
            <div className="flex" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => setConfirmCoef((c) => clampPercentToStep5(c - 5))}
              >
                – 5%
              </button>

              <input
                type="number"
                className="border rounded-lg px-3 py-2 w-28 text-right"
                value={confirmCoef}
                onChange={(e) => setConfirmCoef(clampPercentToStep5(parseInt(e.target.value || "0", 10)))}
                step={5}
                min={50}
                max={500}
              />
              <span>%</span>

              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => setConfirmCoef((c) => clampPercentToStep5(c + 5))}
              >
                + 5%
              </button>
            </div>

            <input
              type="range"
              className="w-full"
              style={{ width: "100%", marginTop: 8 }}
              min={50}
              max={500}
              step={5}
              value={confirmCoef}
              onChange={(e) => setConfirmCoef(parseInt(e.target.value, 10))}
            />

            {/* Sélecteur mono uniquement si machine sélectionnée est mono-tête */}
            {isMono && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", marginBottom: 6 }}>
                  Combien de mono-têtes utilisées ?
                </label>
                <input
                  type="number"
                  min={1}
                  value={monoUnitsUsed}
                  onChange={(e) => {
                    const v = parseInt(e.target.value || "1", 10);
                    setMonoUnitsUsed(isNaN(v) || v < 1 ? 1 : v);
                  }}
                  className="border rounded-lg px-3 py-2 w-28 text-right"
                />
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Nombre de têtes effectif = {selectedMachine.nbTetes} × {Math.max(1, Number(monoUnitsUsed || 1))}
                </div>
              </div>
            )}

            <p style={{ marginTop: 10 }}>
              <strong>Temps réel (appliqué) :</strong>{" "}
              {/* minutesReellesAppliquees est une PROP ; ne pas redéclarer dans ce fichier */}
              {convertHoursToHHMM(minutesReellesAppliquees / 60)}
              {"  "}
              <em style={{ opacity: 0.7 }}>
                (arrondi 5 min • réservation ≈ {Math.ceil(minutesReellesAppliquees / 60)} h)
              </em>
            </p>

            <p style={{ marginTop: 6 }}>
              <strong>Fin estimée avec % :</strong>{" "}
              {currentScenario
                ? new Date(
                    computeProvisionalEnd(currentScenario.debut, minutesReellesAppliquees)
                  ).toLocaleString("fr-FR")
                : "—"}
            </p>
          </div>
        </div>

        <label style={{ marginTop: 12, display: "block" }}>Choisir une autre machine :</label>
        <select
          value={machineAssignee ?? selectedScenario.machine.id}
          onChange={(e) => setMachineAssignee(e.target.value)}
        >
          {machines
            .filter((m) => {
              const machineLabels = toLabelArray(m.etiquettes);
              return neededTypes.every((t) => machineLabels.includes(t));
            })
            .map((m) => {
              const sc = scenarioByMachineId.get(m.id);
              const baseMinutesTheo = sc ? Math.round(Number(sc.dureeTotaleHeuresReelle || 0) * 60) : 0;

              // si c'est une mono, on applique le monoUnitsUsed courant pour l'estimation
              const optionIsMono = Number(m.nbTetes || 1) === 1;
              const adjustedTheo = optionIsMono ? Math.round(baseMinutesTheo / Math.max(1, Number(monoUnitsUsed || 1))) : baseMinutesTheo;

              const minReelForOption = roundMinutesTo5(Math.round((adjustedTheo * confirmCoef) / 100));
              const finAvecCoef = sc ? computeProvisionalEnd(sc.debut, minReelForOption) : null;
              const finLabel = finAvecCoef
                ? ` — fin estimée ${new Date(finAvecCoef).toLocaleString("fr-FR")}`
                : "";

              return (
                <option key={m.id} value={m.id}>
                  {m.nom}{finLabel}
                </option>
              );
            })}
        </select>

        <div style={{ marginTop: 12 }}>
          <button onClick={handleConfirm}>
            Confirmer ce choix
          </button>
          <button className="btn-fermer" onClick={onClose} style={{ marginLeft: 8 }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
