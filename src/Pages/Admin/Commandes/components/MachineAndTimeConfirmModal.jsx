// src/Pages/Admin/Commandes/components/MachineAndTimeConfirmModal.js
import React, { useMemo } from "react";
import { convertHoursToHHMM } from "../../../../utils/time";
import { roundMinutesTo5, clampPercentToStep5, computeProvisionalEnd } from "../utils/timeRealtime";
import { toLabelArray } from "../utils/labels";

const parisFormat = (d, options = {}) =>
  new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...options });

/** Utilitaires tolérants pour extraire les minutes depuis un scénario */
const toMin = (h) => Math.max(0, Math.round(Number(h || 0) * 60));
function extractTheoMinutesFromScenario(scen) {
  if (!scen) return { broderieMin: 0, nettoyageMin: 0, totalMin: 0 };

  // Broderie
  const broderieMin =
    Number.isFinite(scen?.dureeBroderieMinutes)
      ? Math.max(0, Math.round(scen.dureeBroderieMinutes))
      : toMin(
          scen?.dureeBroderieHeures ??
            scen?.dureeBroderieHeuresTheorique ??
            scen?.broderieHeures ??
            0
        );

  // Nettoyage
  const nettoyageMin =
    Number.isFinite(scen?.dureeNettoyageMinutes)
      ? Math.max(0, Math.round(scen.dureeNettoyageMinutes))
      : toMin(
          scen?.dureeNettoyageHeures ??
            scen?.nettoyageHeures ??
            0
        );

  // Total théorique (si non fourni on somme)
  const totalMin =
    Number.isFinite(scen?.dureeTotaleMinutes)
      ? Math.max(0, Math.round(scen.dureeTotaleMinutes))
      : (Number.isFinite(scen?.dureeTotaleHeures) ? toMin(scen.dureeTotaleHeures) : broderieMin + nettoyageMin);

  // Si le total théorique fourni est incohérent, on recalibre
  const safeTotal = Math.max(totalMin, broderieMin + nettoyageMin);

  return { broderieMin, nettoyageMin, totalMin: safeTotal };
}

/** Calcule l'aperçu minutes quand le % s'applique UNIQUEMENT à la broderie */
function computePreviewMinutes({
  scenario,
  percentBroderie, // 50–500 (pas 5)
  isMono,
  monoUnitsUsed = 1,
}) {
  const { broderieMin, nettoyageMin } = extractTheoMinutesFromScenario(scenario);

  // Parallélisation mono : on divise la broderie par le nb d’unités mono
  const units = isMono ? Math.max(1, Number(monoUnitsUsed || 1)) : 1;
  const broderieTheoAdj = Math.round(broderieMin / units);

  // Coef appliqué UNIQUEMENT sur la broderie
  const coef = clampPercentToStep5(Number(percentBroderie || 100));
  const broderieAppliquee = roundMinutesTo5(Math.round((broderieTheoAdj * coef) / 100));

  // Nettoyage inchangé
  const nettoyageApplique = roundMinutesTo5(nettoyageMin);

  const totalTheoAdj = roundMinutesTo5(broderieTheoAdj + nettoyageApplique); // total théorique ajusté (mono)
  const totalApplique = roundMinutesTo5(broderieAppliquee + nettoyageApplique);

  // Coef "équivalent total" (utile si le backend attend encore un coef global sur (B+N))
  const coefTotalEquivalent =
    totalTheoAdj > 0
      ? clampPercentToStep5(Math.round((totalApplique / totalTheoAdj) * 100))
      : 100;

  return {
    broderieTheoAdj,
    nettoyageApplique,   // = nettoyage théorique, non modifié
    totalTheoAdj,
    broderieAppliquee,
    totalApplique,
    coefTotalEquivalent,
  };
}

export default function MachineAndTimeConfirmModal({
  isOpen,
  onClose,
  machines = [],
  formData = {},
  selectedScenario,         // scénario par défaut (machine sélectionnée)
  scenarioByMachineId = {}, // { [machineId]: scenario }
  currentScenario,          // (si utilisé dans ton UI existant)
  confirmCoef,              // % contrôlé par le parent
  setConfirmCoef,
  minutesReellesAppliquees, // (non utilisé ici: on recalcule localement avec la règle broderie-only)
  machineAssignee,
  setMachineAssignee,
  monoUnitsUsed = 1,
  setMonoUnitsUsed,
  onConfirm,                // ({ machineId, coef, monoUnitsUsed }) => void
}) {
  const selectedMachine = useMemo(() => {
    const id = machineAssignee ?? selectedScenario?.machine?.id ?? selectedScenario?.machine_id;
    return (machines || []).find((m) => String(m.id) === String(id)) || selectedScenario?.machine || null;
  }, [machines, machineAssignee, selectedScenario]);

  const isMono = useMemo(() => Number(selectedMachine?.nbTetes || 1) === 1, [selectedMachine]);
  const neededTypes = useMemo(() => toLabelArray(formData?.types), [formData?.types]);

  if (!isOpen || !selectedScenario || !selectedMachine) return null;

  // Aperçu pour la machine sélectionnée (broderie-only %)
  const preview = computePreviewMinutes({
    scenario: selectedScenario,
    percentBroderie: confirmCoef,
    isMono,
    monoUnitsUsed,
  });

  const finEstimee = (() => {
    const end = computeProvisionalEnd(new Date(), preview.totalApplique);
    return end
      ? parisFormat(end, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : null;
  })();

  const handleConfirm = () => {
    const machineId = selectedMachine?.id ?? selectedScenario?.machine?.id;
    // ⚠️ On transmet le coef "équivalent total" pour ne rien casser côté service actuel
    onConfirm?.({
      machineId,
      coef: preview.coefTotalEquivalent,
      monoUnitsUsed: isMono ? Math.max(1, Number(monoUnitsUsed || 1)) : 1,
    });
  };

  const machineOptions = (machines || []).map((m) => {
    // On calcule l’aperçu par machine, avec la même règle broderie-only
    const scen = scenarioByMachineId?.[m.id] || (String(selectedMachine?.id) === String(m.id) ? selectedScenario : null);
    if (!scen) return { m, label: m.nom || m.name || `Machine ${m.id}` };

    const isMonoThis = Number(m.nbTetes || 1) === 1;
    const pv = computePreviewMinutes({
      scenario: scen,
      percentBroderie: confirmCoef,
      isMono: isMonoThis,
      monoUnitsUsed: isMonoThis ? monoUnitsUsed : 1,
    });

    const end = computeProvisionalEnd(new Date(), pv.totalApplique);
    const finLabel = end ? ` — fin ${parisFormat(end, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}` : "";

    return {
      m,
      label: `${m.nom || m.name || `Machine ${m.id}`} (${pv.totalApplique} min)${finLabel}`,
    };
  });

  return (
    <div className="modal__backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal__header">
          <h3>Confirmer machine & durée</h3>
          <button className="btn-fermer" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="modal__content">
          <div className="muted" style={{ marginBottom: 8 }}>
            Types d’article : {neededTypes.length ? neededTypes.join(" • ") : "—"}
          </div>

          {/* Réglage du % appliqué (UNIQUEMENT broderie) */}
          <div style={{ marginTop: 8 }}>
            <label>
              Coefficient broderie (%)
              <input
                type="range"
                min={50}
                max={500}
                step={5}
                value={clampPercentToStep5(Number(confirmCoef || 100))}
                onChange={(e) => setConfirmCoef?.(clampPercentToStep5(Number(e.target.value)))}
                style={{ width: "100%" }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>50%</span><strong>{clampPercentToStep5(Number(confirmCoef || 100))}%</strong><span>500%</span>
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              (Le pourcentage s’applique uniquement au temps de <strong>broderie</strong>. Le <em>nettoyage</em> reste inchangé.)
            </div>
          </div>

          {/* Parallélisation mono */}
          {isMono && (
            <div style={{ marginTop: 12 }}>
              <label>
                Nombre d’unités mono utilisées en parallèle
                <input
                  type="number"
                  min={1}
                  value={Number(monoUnitsUsed || 1)}
                  onChange={(e) => setMonoUnitsUsed?.(Math.max(1, Number(e.target.value) || 1))}
                  style={{ marginLeft: 8, width: 80 }}
                />
              </label>
              <div className="muted" style={{ marginTop: 4 }}>
                La broderie théorique est divisée par ce nombre. Le nettoyage n’est pas modifié.
              </div>
            </div>
          )}

          {/* Récap’ durée (théorique vs appliquée) */}
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
                onChange={(e) => setMachineAssignee?.(e.target.value)}
                style={{ marginLeft: 8 }}
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
