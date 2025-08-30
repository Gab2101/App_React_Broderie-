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
  // minutes réelles déjà calculées en amont (minutes, arrondi 5 appliqué côté appelant si besoin)
  minutesReellesAppliquees,
  machineAssignee,
  setMachineAssignee,
  monoUnitsUsed,
  setMonoUnitsUsed,
  onConfirm,
}) {
  const selectedMachine = useMemo(() => {
    const id = machineAssignee ?? selectedScenario?.machine?.id;
    return machines.find((m) => String(m.id) === String(id)) || selectedScenario?.machine || null;
  }, [machines, machineAssignee, selectedScenario]);

  const isMono = useMemo(() => Number(selectedMachine?.nbTetes || 1) === 1, [selectedMachine]);
  const neededTypes = useMemo(() => toLabelArray(formData?.types), [formData?.types]);

  if (!isOpen || !selectedScenario || !selectedMachine) return null;

  const handleConfirm = () => {
    const machineId = machineAssignee ?? selectedScenario.machine.id;

    // Théorie (heures → minutes) depuis le scénario
    const baseTheoMinRaw = Math.round(Number(selectedScenario.dureeTotaleHeuresReelle || 0) * 60);
    const monoUnits = isMono ? Math.max(1, Number(monoUnitsUsed || 1)) : 1;
    const duration_minutes = isMono ? Math.round(baseTheoMinRaw / monoUnits) : baseTheoMinRaw;

    // Nettoyage (heures → minutes) depuis le scénario (attaché à la ligne mono)
    const cleaning_minutes = Math.max(0, Math.round(Number(selectedScenario.dureeNettoyageHeures || 0) * 60));

    // % appliqué et minutes calculées (après % + arrondi 5)
    const coef = Math.max(50, Math.min(500, Number(confirmCoef || 100)));
    const duration_calc_minutes = roundMinutesTo5(Math.round((duration_minutes * coef) / 100));
    const extra_percent = Math.max(0, coef - 100);

    // Planification proposée
    const planned_start = currentScenario?.debut ?? null;
    const planned_end = planned_start ? computeProvisionalEnd(planned_start, duration_calc_minutes) : null;

    // Quantité totale de la commande (mono = pas d’éclatement)
    const qty = Math.max(1, Number(formData?.quantite || 1));

    // Payload prêt pour commandes_assignations
    const assignation = {
      commande_id: formData?.id,           // bigint (commande globale)
      machine_id: machineId,               // uuid
      qty,                                 // integer > 0
      duration_minutes,                    // théorie
      duration_calc_minutes,               // après % + arrondi 5
      cleaning_minutes,                    // minutes de nettoyage
      extra_percent,                       // coef - 100
      planned_start,                       // timestamptz | null
      planned_end,                         // timestamptz | null
      status: 'A commencer',
    };

    onConfirm({
      machineId,
      coef,
      monoUnitsUsed: monoUnits,
      minutesReellesAppliquees: duration_calc_minutes, // pour cohérence d’affichage en amont
      assignation,                                     // ⬅️ à insérer dans commandes_assignations
      flow: 'mono',
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Confirmer la machine & le temps réel</h2>

        <p><strong>Machine proposée :</strong> {selectedScenario.machine.nom}</p>

        <div className="grid-2cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p><strong>Temps broderie (théorique) :</strong> {convertHoursToHHMM(selectedScenario.dureeBroderieHeures)}</p>
            <p><strong>Temps nettoyage (théorique) :</strong> {convertHoursToHHMM(selectedScenario.dureeNettoyageHeures)}</p>
            <p><strong>Temps total (théorique) :</strong> {convertHoursToHHMM(selectedScenario.dureeTotaleHeuresReelle)}</p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Pourcentage appliqué (temps réel)</label>
            <div className="flex" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setConfirmCoef((c) => clampPercentToStep5(c - 5))}>– 5%</button>
              <input
                type="number" className="border rounded-lg px-3 py-2 w-28 text-right"
                value={confirmCoef}
                onChange={(e) => setConfirmCoef(clampPercentToStep5(parseInt(e.target.value || "0", 10)))}
                step={5} min={50} max={500}
              />
              <span>%</span>
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setConfirmCoef((c) => clampPercentToStep5(c + 5))}>+ 5%</button>
            </div>

            <input
              type="range" className="w-full" style={{ width: "100%", marginTop: 8 }}
              min={50} max={500} step={5}
              value={confirmCoef}
              onChange={(e) => setConfirmCoef(parseInt(e.target.value, 10))}
            />

            {isMono && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", marginBottom: 6 }}>Combien de mono-têtes utilisées ?</label>
                <input
                  type="number" min={1}
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
              {convertHoursToHHMM((minutesReellesAppliquees || 0) / 60)}
              {"  "}
              <em style={{ opacity: 0.7 }}>
                (arrondi 5 min • réservation ≈ {Math.ceil((minutesReellesAppliquees || 0) / 60)} h)
              </em>
            </p>

            <p style={{ marginTop: 6 }}>
              <strong>Fin estimée avec % :</strong>{" "}
              {currentScenario
                ? new Date(computeProvisionalEnd(currentScenario.debut, minutesReellesAppliquees || 0)).toLocaleString("fr-FR")
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
              const optionIsMono = Number(m.nbTetes || 1) === 1;
              const adjustedTheo = optionIsMono ? Math.round(baseMinutesTheo / Math.max(1, Number(monoUnitsUsed || 1))) : baseMinutesTheo;
              const minReelForOption = roundMinutesTo5(Math.round((adjustedTheo * (confirmCoef || 100)) / 100));
              const finAvecCoef = sc ? computeProvisionalEnd(sc.debut, minReelForOption) : null;
              const finLabel = finAvecCoef ? ` — fin estimée ${new Date(finAvecCoef).toLocaleString("fr-FR")}` : "";
              return (
                <option key={m.id} value={m.id}>
                  {m.nom}{finLabel}
                </option>
              );
            })}
        </select>

        <div style={{ marginTop: 12 }}>
          <button onClick={handleConfirm}>Confirmer ce choix</button>
          <button className="btn-fermer" onClick={onClose} style={{ marginLeft: 8 }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
