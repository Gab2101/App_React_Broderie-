// src/Pages/Admin/Commandes/components/MachineAndTimeConfirmModal.jsx
import React, { useMemo } from "react";
import { convertHoursToHHMM } from "../../../../utils/time";
import {
  roundMinutesTo5,
  clampPercentToStep5,
  computeProvisionalEnd,
} from "../utils/timeRealtime";
import { toLabelArray } from "../utils/labels";

export default function MachineAndTimeConfirmModal({
  isOpen,
  onClose,
  machines = [],
  formData = {},
  selectedScenario,          // { machine, dureeBroderieHeures, dureeNettoyageHeures, dureeTotaleHeuresReelle, ... }
  scenarioByMachineId,       // Map(machineId -> scenario)
  currentScenario,           // { debut, ... }
  confirmCoef,
  setConfirmCoef,
  minutesReellesAppliquees,  // (optionnel) legacy — on n’en dépend plus pour l’affichage
  machineAssignee,
  setMachineAssignee,
  monoUnitsUsed,
  setMonoUnitsUsed,
  onConfirm,                 // ({ machineId, coef, monoUnitsUsed, minutesReellesAppliquees, assignation, flow:'mono' })
}) {
  // ---------- Garde-fous ----------
  if (!isOpen || !selectedScenario) return null;

  // ---------- Machine sélectionnée ----------
  const selectedMachine = useMemo(() => {
    const id = machineAssignee ?? selectedScenario?.machine?.id;
    return (
      machines.find((m) => String(m.id) === String(id)) ||
      selectedScenario?.machine ||
      null
    );
  }, [machines, machineAssignee, selectedScenario]);

  if (!selectedMachine) return null;

  const isMono = useMemo(
    () => Number(selectedMachine?.nbTetes || 1) === 1,
    [selectedMachine]
  );

  const neededTypes = useMemo(
    () => toLabelArray(formData?.types),
    [formData?.types]
  );

  // ---------- Durées de base (théorie) ----------
  // total théorique (heures) provenant du scénario (broderie + nettoyage)
  const totalTheoHours = Number(selectedScenario?.dureeTotaleHeuresReelle || 0);
  // minutes théoriques brutes arrondies à l’entier (pour cohérence)
  const baseTheoMinRaw = useMemo(
    () => Math.max(0, Math.round(totalTheoHours * 60)),
    [totalTheoHours]
  );

  // ---------- Mono-units & minutes théoriques par “ligne” ----------
  const monoUnits = useMemo(
    () => (isMono ? Math.max(1, Number(monoUnitsUsed || 1)) : 1),
    [isMono, monoUnitsUsed]
  );

  // théorie appliquée à la sélection mono (si mono → on divise par le nb de monoUnits)
  const duration_minutes = useMemo(() => {
    if (!isMono) return baseTheoMinRaw;
    // division entière “safe” (arrondi standard pour rester proche du total)
    return Math.max(0, Math.round(baseTheoMinRaw / monoUnits));
  }, [isMono, baseTheoMinRaw, monoUnits]);

  // minutes nettoyage (théoriques) — attachées à la ligne mono (cohérent avec ton code)
  const cleaning_minutes = useMemo(
    () =>
      Math.max(
        0,
        Math.round(Number(selectedScenario?.dureeNettoyageHeures || 0) * 60)
      ),
    [selectedScenario?.dureeNettoyageHeures]
  );

  // ---------- Coef (%) & minutes “réelles” (appliquées) live ----------
  const coef = useMemo(
    () => Math.max(50, Math.min(500, Number(confirmCoef || 100))),
    [confirmCoef]
  );
  const extra_percent = useMemo(() => Math.max(0, coef - 100), [coef]);

  // minutes réelles après % + arrondi 5 minutes
  const minutesCalcLive = useMemo(() => {
    const m = Math.round((duration_minutes * coef) / 100);
    return roundMinutesTo5(m);
  }, [duration_minutes, coef]);

  // ---------- Planification “prévisionnelle” ----------
  const planned_start = currentScenario?.debut ?? null;
  const planned_end = useMemo(() => {
    if (!planned_start) return null;
    return computeProvisionalEnd(planned_start, minutesCalcLive);
  }, [planned_start, minutesCalcLive]);

  // ---------- UI Helpers ----------
  const machineIdForSelect = useMemo(
    () => machineAssignee ?? selectedScenario.machine.id,
    [machineAssignee, selectedScenario?.machine?.id]
  );

  // ---------- Confirm ----------
  const handleConfirm = () => {
    const machineId = machineAssignee ?? selectedScenario.machine.id;
    const qty = Math.max(1, Number(formData?.quantite || 1)); // pas d’éclatement en mono

    const assignation = {
      commande_id: formData?.id ?? null,
      machine_id: machineId,
      qty,
      // théorie AVANT coef/arrondi
      duration_minutes,
      // après coef + arrondi 5
      duration_calc_minutes: minutesCalcLive,
      cleaning_minutes,
      extra_percent,            // permet d’afficher “(350% appliqué)” côté carte si tu le répercutes sur la commande
      planned_start,            // peut rester null si non fixé
      planned_end,              // idem
      status: "A commencer",
    };

    onConfirm?.({
      machineId,
      coef,
      monoUnitsUsed: monoUnits,
      minutesReellesAppliquees: minutesCalcLive,
      assignation,
      flow: "mono",
    });
  };

  // ---------- Render ----------
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Confirmer la machine & le temps réel</h2>

        <p>
          <strong>Machine proposée :</strong>{" "}
          {selectedScenario.machine?.nom || selectedMachine?.nom}
        </p>

        <div
          className="grid-2cols"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* Colonne de gauche : récap théorie */}
          <div>
            <p>
              <strong>Temps broderie (théorique) :</strong>{" "}
              {convertHoursToHHMM(
                Number(selectedScenario?.dureeBroderieHeures || 0)
              )}
            </p>
            <p>
              <strong>Temps nettoyage (théorique) :</strong>{" "}
              {convertHoursToHHMM(
                Number(selectedScenario?.dureeNettoyageHeures || 0)
              )}
            </p>
            <p>
              <strong>Temps total (théorique) :</strong>{" "}
              {convertHoursToHHMM(totalTheoHours)}
            </p>
            {isMono && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", marginBottom: 6 }}>
                  Combien de mono-têtes utilisées ?
                </label>
                <input
                  type="number"
                  min={1}
                  value={monoUnitsUsed}
                  onChange={(e) => {
                    const v = parseInt(e.target.value || "1", 10);
                    setMonoUnitsUsed?.(isNaN(v) || v < 1 ? 1 : v);
                  }}
                  className="border rounded-lg px-3 py-2 w-28 text-right"
                />
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Nombre de têtes effectif = {selectedMachine.nbTetes} ×{" "}
                  {Math.max(1, Number(monoUnitsUsed || 1))}
                </div>
              </div>
            )}
          </div>

          {/* Colonne de droite : réglage coef + aperçu “réel” */}
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>
              Pourcentage appliqué (temps réel)
            </label>
            <div
              className="flex"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() =>
                  setConfirmCoef?.((c) => clampPercentToStep5((c || 100) - 5))
                }
              >
                – 5%
              </button>
              <input
                type="number"
                className="border rounded-lg px-3 py-2 w-28 text-right"
                value={confirmCoef}
                onChange={(e) =>
                  setConfirmCoef?.(
                    clampPercentToStep5(parseInt(e.target.value || "0", 10))
                  )
                }
                step={5}
                min={50}
                max={500}
              />
              <span>%</span>
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() =>
                  setConfirmCoef?.((c) => clampPercentToStep5((c || 100) + 5))
                }
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
              onChange={(e) => setConfirmCoef?.(parseInt(e.target.value, 10))}
            />

            <p style={{ marginTop: 10 }}>
              <strong>Temps réel (appliqué) :</strong>{" "}
              {convertHoursToHHMM(minutesCalcLive / 60)}{" "}
              <em style={{ opacity: 0.7 }}>
                (arrondi 5 min • réservation ≈{" "}
                {Math.ceil(minutesCalcLive / 60)} h)
              </em>
            </p>

            <p style={{ marginTop: 6 }}>
              <strong>Fin estimée avec % :</strong>{" "}
              {planned_end
                ? new Date(planned_end).toLocaleString("fr-FR")
                : "—"}
            </p>
          </div>
        </div>

        <label style={{ marginTop: 12, display: "block" }}>
          Choisir une autre machine :
        </label>
        <select
          value={machineIdForSelect}
          onChange={(e) => setMachineAssignee?.(e.target.value)}
        >
          {machines
            .filter((m) => {
              const machineLabels = toLabelArray(m.etiquettes);
              return neededTypes.every((t) => machineLabels.includes(t));
            })
            .map((m) => {
              const sc = scenarioByMachineId.get(m.id);
              const baseTheoMin = sc
                ? Math.round(Number(sc.dureeTotaleHeuresReelle || 0) * 60)
                : 0;
              const optionIsMono = Number(m.nbTetes || 1) === 1;
              const adjustedTheo = optionIsMono
                ? Math.round(baseTheoMin / Math.max(1, Number(monoUnitsUsed || 1)))
                : baseTheoMin;

              const minReelForOption = roundMinutesTo5(
                Math.round((adjustedTheo * (confirmCoef || 100)) / 100)
              );
              const finAvecCoef = sc
                ? computeProvisionalEnd(sc.debut, minReelForOption)
                : null;
              const finLabel = finAvecCoef
                ? ` — fin estimée ${new Date(finAvecCoef).toLocaleString("fr-FR")}`
                : "";
              return (
                <option key={m.id} value={m.id}>
                  {m.nom}
                  {finLabel}
                </option>
              );
            })}
        </select>

        <div style={{ marginTop: 12 }}>
          <button onClick={handleConfirm}>Confirmer ce choix</button>
          <button className="btn-fermer" onClick={onClose} style={{ marginLeft: 8 }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
