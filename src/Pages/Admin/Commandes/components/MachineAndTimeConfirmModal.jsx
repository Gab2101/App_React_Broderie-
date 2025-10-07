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

  // Debug: Check what's being passed to the modal
  React.useEffect(() => {
    console.log('[MachineAndTimeConfirmModal] Debug props:', {
      machinesCount: machines?.length || 0,
      scenarioByMachineIdKeys: Object.keys(scenarioByMachineId || {}),
      selectedMachineId: selectedMachine?.id,
      allScenarios: scenarioByMachineId,
    });
  }, [machines, scenarioByMachineId, selectedMachine]);

  // Get compatible machines (only those with scenarios)
  const compatibleMachineIds = React.useMemo(() => {
    // scenarioByMachineId is a Map, not a plain object!
    if (scenarioByMachineId instanceof Map) {
      return Array.from(scenarioByMachineId.keys());
    }
    return Object.keys(scenarioByMachineId || {});
  }, [scenarioByMachineId]);

  const compatibleMachines = React.useMemo(() => {
    return machines.filter(m => compatibleMachineIds.includes(String(m.id)));
  }, [machines, compatibleMachineIds]);

  // Ensure selected machine is included in options even if not compatible
  const machineOptions = React.useMemo(() => {
    const baseMachines = [...compatibleMachines];
    if (selectedMachine && !baseMachines.find(m => String(m.id) === String(selectedMachine.id))) {
      baseMachines.unshift(selectedMachine); // Add selected machine at the beginning
    }
    return baseMachines.map((m) => {
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
  }, [compatibleMachines, selectedMachine, scenarioByMachineId, selectedScenario, confirmCoef, monoUnitsUsed]);

  const isMono = useMemo(() => Number(currentScenario?.machine?.nbTetes || 1) === 1, [currentScenario]);
  const neededTypes = useMemo(() => toLabelArray(formData?.types), [formData?.types]);

  if (!isOpen || !selectedScenario || !selectedMachine) return null;

  // Aperçu pour la machine sélectionnée (broderie-only %)
  const preview = computePreviewMinutes({
    scenario: currentScenario, // Use currentScenario to reflect dropdown selection
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



  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        margin: '20px',
      }}>
        <h2 style={{
          marginTop: 0,
          marginBottom: '16px',
          fontSize: '24px',
          fontWeight: '600',
          color: '#2c3e50',
        }}>
          Confirmer machine & durée
        </h2>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
            }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#6b7280',
          }}>
            <strong>Types d'article :</strong> {neededTypes.length ? neededTypes.join(" • ") : "—"}
          </div>
        </div>

        {/* Réglage du % appliqué (UNIQUEMENT broderie) */}
        <div style={{
          marginBottom: '20px',
        }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Coefficient broderie (%)
            <input
              type="range"
              min={50}
              max={500}
              step={5}
              value={clampPercentToStep5(Number(confirmCoef || 100))}
              onChange={(e) => setConfirmCoef?.(clampPercentToStep5(Number(e.target.value)))}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '8px',
                accentColor: '#007bff',
              }}
            />
          </label>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '4px',
          }}>
            <span>50%</span>
            <strong style={{ color: '#007bff' }}>
              {clampPercentToStep5(Number(confirmCoef || 100))}%
            </strong>
            <span>500%</span>
          </div>
          <p style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '1.4',
          }}>
            Le pourcentage s'applique uniquement au temps de <strong>broderie</strong>. Le <em>nettoyage</em> reste inchangé.
          </p>
        </div>

        {/* Parallélisation mono */}
        {isMono && (
          <div style={{
            marginBottom: '20px',
          }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#374151',
            }}>
              Nombre d'unités mono utilisées en parallèle
              <input
                type="number"
                min={1}
                value={Number(monoUnitsUsed || 1)}
                onChange={(e) => setMonoUnitsUsed?.(Math.max(1, Number(e.target.value) || 1))}
                style={{
                  marginLeft: '12px',
                  width: '80px',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </label>
            <p style={{
              marginTop: '4px',
              fontSize: '12px',
              color: '#6b7280',
            }}>
              La broderie théorique est divisée par ce nombre. Le nettoyage n'est pas modifié.
            </p>
          </div>
        )}

        {/* Récap' durée (théorique vs appliquée) */}
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: '#fafafa',
          fontSize: '14px',
        }}>
          <h4 style={{
            marginTop: 0,
            marginBottom: '12px',
            fontSize: '16px',
            color: '#374151'
          }}>
            Résumé des durées
          </h4>

          <div style={{ lineHeight: '1.6' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Broderie (théorique adj.)</strong> : {preview.broderieTheoAdj} min
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Nettoyage (théorique)</strong> : {preview.nettoyageApplique} min
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>Total théorique</strong> : {preview.totalTheoAdj} min ({convertHoursToHHMM(preview.totalTheoAdj / 60)})
            </div>

            <hr style={{ borderColor: '#e5e7eb', margin: '12px 0' }} />

            <div style={{ marginBottom: '8px' }}>
              <strong>Broderie appliquée</strong> : {preview.broderieAppliquee} min
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Total appliqué</strong> : {preview.totalApplique} min ({convertHoursToHHMM(preview.totalApplique / 60)})
            </div>

            {finEstimee && (
              <div style={{
                color: '#6b7280',
                fontStyle: 'italic',
                marginTop: '8px'
              }}>
                Fin estimée : {finEstimee}
              </div>
            )}
          </div>
        </div>

        {/* Choix de la machine avec ETA par option */}
        <div style={{
          marginBottom: '24px',
        }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Machine
            <select
              value={selectedMachine?.id ?? ""}
              onChange={(e) => setMachineAssignee?.(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                backgroundColor: 'white',
              }}
            >
              {machineOptions.map(({ m, label }) => (
                <option key={m.id} value={m.id}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Annuler
          </button>

          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
            }}
          >
            Confirmer ce choix
          </button>
        </div>
      </div>
    </div>
  );
}
