import React from "react";
import { convertHoursToHHMM } from "../../../../utils/time";
import { computeProvisionalEnd } from "../utils/timeRealtime";
import { calculerDurees } from "../../../../utils/calculs";
import { DEFAULT_WORKDAY, snapToNextWorkStart, addMinutesWithinWorkHours } from "../utils/workhours";

const parisFormat = (d, options = {}) =>
  new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...options });

export default function MachineAndTimeConfirmModal({
  isOpen,
  onClose,
  machines = [],
  formData = {},
  machineAssignee,
  setMachineAssignee,
  onConfirm,
}) {
  if (!isOpen) return null;

  // State for efficiency coefficient
  const [efficiencyCoef, setEfficiencyCoef] = React.useState(200); // Default 200%

  // Calculate time coefficient (applies only to stitching time)
  const timeMultiplier = efficiencyCoef / 100; // Convert % to multiplier

  // Calculate times for all machines
  const machineOptions = React.useMemo(() => {
    return machines.map((machine) => {
      const { dureeTotaleHeures } = calculerDurees({
        quantite: Number(formData.quantite || 0),
        points: Number(formData.points || 0),
        vitesse: Number(formData.vitesseMoyenne || 750), // Default stitches/min
        nbTetes: Number(machine.nbTetes || 1),
        nettoyageParArticleSec: 0, // Simplified - no cleaning calculation
      });

      // Apply efficiency coefficient to stitching time
      const adjustedMinutes = Math.ceil((dureeTotaleHeures * 60) * timeMultiplier);

      // Calculate estimated end time
      const now = snapToNextWorkStart(new Date(), DEFAULT_WORKDAY);
      const { end } = addMinutesWithinWorkHours(now, adjustedMinutes, DEFAULT_WORKDAY);
      const finLabel = end
        ? ` — fin ${end.toLocaleString('fr-FR', {
            timeZone: 'Europe/Paris',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          })}`
        : '';

      const label = `${machine.nom || machine.name || `Machine ${machine.id}`} (${adjustedMinutes} min)${finLabel}`;

      return { machine, label, totalMinutes: adjustedMinutes };
    });
  }, [machines, formData, efficiencyCoef]);

  // Get selected machine for preview
  const selectedMachine = machines.find(m => String(m.id) === String(machineAssignee));

  const handleConfirm = () => {
    if (!machineAssignee) return;
    onConfirm?.({ machineId: machineAssignee });
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

        {/* Order summary */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            marginTop: 0,
            marginBottom: '12px',
            fontSize: '18px',
            fontWeight: '500',
            color: '#374151'
          }}>
            Résumé commande
          </h3>

          <div style={{
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#fafafa',
            fontSize: '14px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <strong>Numéro:</strong> {formData.numero || 'N/A'}
              </div>
              <div>
                <strong>Client:</strong> {formData.client || 'N/A'}
              </div>
              <div>
                <strong>Quantité:</strong> {formData.quantite || 0}
              </div>
              <div>
                <strong>Points:</strong> {formData.points || 0}
              </div>
              <div>
                <strong>Vitesse:</strong> {formData.vitesseMoyenne || 750} pts/min
              </div>
              <div>
                <strong>Urgence:</strong> {formData.urgence || 3}/5
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <strong>État:</strong> {formData.deballe ? 'Déballée' : 'À déballer'}
                </div>
                <div>
                  <strong>Validation:</strong> {formData.validation_client ? 'Validée' : 'À valider'}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Date livraison:</strong> {formData.dateLivraison ? new Date(formData.dateLivraison).toLocaleDateString('fr-FR') : 'Non spécifiée'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Efficiency coefficient slider */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Coefficient d'efficacité (%)
            <input
              type="range"
              min={50}
              max={500}
              step={5}
              value={efficiencyCoef}
              onChange={(e) => setEfficiencyCoef(Number(e.target.value))}
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
              {efficiencyCoef}%
            </strong>
            <span>500%</span>
          </div>
          <p style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '1.4',
          }}>
            Le coefficient s'applique uniquement au temps de broderie. Plus le coefficient est élevé, plus la durée estimée est longue.
          </p>
        </div>

        {/* Machine selection with time display */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Machine et durée estimée
            <select
              value={machineAssignee || ""}
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
              <option value="">Sélectionner une machine</option>
              {machineOptions.map(({ machine, label }) => (
                <option key={machine.id} value={machine.id}>
                  {label}
                </option>
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
            disabled={!machineAssignee}
            style={{
              padding: '8px 16px',
              backgroundColor: machineAssignee ? '#007bff' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: machineAssignee ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={machineAssignee ? (e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            } : undefined}
            onMouseOut={machineAssignee ? (e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
            } : undefined}
          >
            Confirmer ce choix
          </button>
        </div>
      </div>
    </div>
  );
}

MachineAndTimeConfirmModal.displayName = 'MachineAndTimeConfirmModal';
