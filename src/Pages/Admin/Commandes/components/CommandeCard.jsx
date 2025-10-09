import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import StatusBadge from "@/components/common/StatusBadge.jsx";
import { convertDecimalToTime } from "@/utils/time";

const STATUTS = ["A commencer", "En cours", "Terminée"];

const noop = () => {}
const asFn = (fn, name) => {
  const ok = fn == null || typeof fn === 'function'
  if (!ok) console.error(`[CommandeCard] prop ${name} must be a function, got:`, typeof fn, fn)
  return ok ? fn : noop
}

export default function CommandeCard(props = {}) {
  // Compat noms de props (ancien → nouveau)
  const commande = props.commande ?? props.cmd ?? {}
  const machineColor = props.machineColor ?? '#ffffff'
  const onStatusChange = asFn(props.onStatusChange ?? props.onStatutChange, 'onStatusChange')
  const onEdit = asFn(props.onEdit, 'onEdit')
  const onDelete = asFn(props.onDelete, 'onDelete')
  const onDeballeChange = asFn(props.onDeballeChange ?? props.onToggleDeballe, 'onDeballeChange')
  const onValidationChange = asFn(props.onValidationChange ?? props.onClientValidationChange, 'onValidationChange')

  const {
    hideADeballerUI = false,
    livraisonLabel,
    debutLabel,
    finLabel,
    t,
    coefAffiche
  } = props

  // --- ÉTAT LOCAL CONTRÔLÉ ---
  const [savingDeballe, setSavingDeballe] = useState(false)
  const [deballeLocal, setDeballeLocal] = useState(Boolean(commande?.deballe))
  const [localStatut, setLocalStatut] = useState(commande?.statut ?? 'A commencer')
  const [savingValidation, setSavingValidation] = useState(false)
  const [validationLocal, setValidationLocal] = useState(Boolean(commande?.validation_client))

  // Sync depuis props quand la commande change / quand son statut/flag change côté parent
  useEffect(() => {
    setDeballeLocal(Boolean(commande?.deballe))
  }, [commande?.id, commande?.deballe])

  useEffect(() => {
    setLocalStatut(commande?.statut ?? 'A commencer')
  }, [commande?.id, commande?.statut])

  useEffect(() => {
    setValidationLocal(Boolean(commande?.validation_client))
  }, [commande?.id, commande?.validation_client])

  // --- HANDLERS ---
  const handleDeballeChange = useCallback(async (checked) => {
    setSavingDeballe(true)
    setDeballeLocal(checked)             // UI optimiste
    try {
      await onDeballeChange(commande.id, checked)
    } finally {
      setSavingDeballe(false)
    }
  }, [commande?.id, onDeballeChange])

  const handleStatusChange = useCallback((e) => {
    let statut = e?.target?.value ?? e?.value ?? e;
    if (!statut && e?.target?.selectedIndex != null) {
      const opt = e.target.options[e.target.selectedIndex];
      statut = opt?.value ?? opt?.text ?? '';
    }
    setLocalStatut(statut);
    onStatusChange(commande.id, statut);
  }, [commande?.id, onStatusChange])

  const handleEdit = useCallback(() => {
    // Signature standardisée: onEdit(commande)
    onEdit(commande)
  }, [onEdit, commande])

  const handleDelete = useCallback(() => {
    onDelete(commande.id)
  }, [onDelete, commande?.id])

  const handleValidationChange = useCallback(async (checked) => {
    setSavingValidation(true)
    setValidationLocal(checked)             // UI optimiste
    try {
      await onValidationChange(commande.id, checked)
    } finally {
      setSavingValidation(false)
    }
  }, [commande?.id, onValidationChange])

  return (
    <div
      className="carte-commande carte-commande--micro"
      style={{
        position: "relative", // ✅ Fix pour la vignette absolue
        border: `2px solid ${machineColor}`,
        borderRadius: 8,
        padding: 8, // Reduced from 12px
        marginBottom: 6, // Reduced from 8px
        backgroundColor: `${machineColor}08`, // Subtle background tint
        boxShadow: `0 2px 8px rgba(0,0,0,0.1)`,
        zIndex: 10 // forcing high z-index
      }}
      data-testid={`commande-card-${commande?.id ?? 'unknown'}`}
    >
      {/* Alert banners - stacked vertically in top-right */}
      <div style={{
        position: "absolute",
        top: 8,
        right: 8,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        alignItems: "flex-end",
        zIndex: 11
      }}>
        {!hideADeballerUI && !deballeLocal && (
          <div
            style={{
              backgroundColor: "#ff6b35",
              color: "white",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: "bold",
              pointerEvents: 'none'
            }}
            title="Commande à déballer"
          >
            À déballer
          </div>
        )}

        {validationLocal === false && (
          <div
            style={{
              backgroundColor: "#ffc107",
              color: "#212529",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: "bold",
              pointerEvents: 'none'
            }}
            title="Validation client requise"
          >
            À valider
          </div>
        )}
      </div>

      <div
        className="carte-commande__header"
        style={{ marginBottom: 12 }}
      >
        <h3 style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>Commande #{commande?.numero ?? commande?.id}</h3>
      </div>

      {!hideADeballerUI && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "6px"
        }}>
          <input
            type="checkbox"
            checked={deballeLocal}
            onChange={(e) => handleDeballeChange(e.target.checked)}
            disabled={savingDeballe}
            style={{
              width: "16px",
              height: "16px"
            }}
          />
          <span style={{ fontSize: "14px", fontWeight: "400" }}>
            Commande déballée {savingDeballe ? "…" : ""}
          </span>
        </div>
      )}

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: "6px"
      }}>
        <input
          type="checkbox"
          checked={validationLocal}
          onChange={(e) => handleValidationChange(e.target.checked)}
          disabled={savingValidation}
          style={{
            width: "16px",
            height: "16px"
          }}
        />
        <span style={{ fontSize: "14px", fontWeight: "400" }}>
          Validation client {savingValidation ? "…" : ""}
        </span>
      </div>

      <div style={{ marginBottom: "6px" }}>
        <span style={{ fontSize: "14px", fontWeight: "600" }}>Client :</span>{" "}
        <span style={{ fontSize: "14px", fontWeight: "400" }}>{commande.client}</span>
      </div>

      {Array.isArray(commande.types) && commande.types.length > 0 && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ fontSize: "14px", fontWeight: "600" }}>Types textile :</span>{" "}
          <span style={{ fontSize: "14px", fontWeight: "400" }}>{commande.types.join(", ")}</span>
        </div>
      )}

      <div style={{ marginBottom: "6px" }}>
        <span style={{ fontSize: "14px", fontWeight: "600" }}>Quantité :</span>{" "}
        <span style={{ fontSize: "14px", fontWeight: "400" }}>{commande.quantite}</span>
      </div>

      <div style={{ marginBottom: "6px" }}>
        <span style={{ fontSize: "14px", fontWeight: "600" }}>Points :</span>{" "}
        <span style={{ fontSize: "14px", fontWeight: "400" }}>{commande.points}</span>
      </div>

      <div style={{ marginBottom: "6px" }}>
        <span style={{ fontSize: "14px", fontWeight: "600" }}>Livraison :</span>{" "}
        <span style={{ fontSize: "14px", fontWeight: "400" }}>{livraisonLabel || "—"}</span>
      </div>

      {debutLabel && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ fontSize: "14px", fontWeight: "600" }}>Début de commande :</span>{" "}
          <span style={{ fontSize: "14px", fontWeight: "400" }}>{debutLabel}</span>
        </div>
      )}
      {finLabel && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ fontSize: "14px", fontWeight: "600" }}>Fin de commande :</span>{" "}
          <span style={{ fontSize: "14px", fontWeight: "400" }}>{finLabel}</span>
        </div>
      )}

      {(commande.linked_commande_id || commande.same_machine_as_linked || commande.start_after_linked) && (
        <div className="bloc-liaison-info" style={{
          marginBottom: "6px",
          fontSize: "14px",
          lineHeight: "1.4"
        }}>
          <span style={{ fontSize: "14px", fontWeight: "600" }}>Liaison :</span>{" "}
          <span style={{ fontSize: "14px", fontWeight: "400" }}>
            {commande.linked_commande_id ? `#${commande.linked_commande_id}` : "—"} •{" "}
            {commande.same_machine_as_linked ? "Même machine" : "Machine différente"} •{" "}
            {commande.start_after_linked ? "Après la liée" : "Parallèle"}
          </span>
        </div>
      )}

      <div style={{ marginBottom: "10px" }}>
        <span style={{ fontSize: "14px", fontWeight: "600" }}>Durée totale :</span>{" "}
        <span style={{ fontSize: "14px", fontWeight: "400" }}>
          {convertDecimalToTime(t ?? 0)}
          {coefAffiche ? <em style={{ marginLeft: 6, opacity: 0.7, fontSize: "13px" }}>({coefAffiche}% appliqué)</em> : null}
        </span>
      </div>

      {/* Status Control Section - at bottom */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
        marginBottom: 8
      }}>
        <label style={{
          fontWeight: "500",
          color: "#495057",
          fontSize: "14px",
          margin: 0
        }}>
          Statut:
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusBadge statut={localStatut} size="sm" />
          <select
            value={localStatut}
            onChange={handleStatusChange}
            style={{
              padding: "6px 8px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              backgroundColor: "white",
              height: "32px"
            }}
            data-testid="statut-select"
            aria-label="Statut"
          >
            {STATUTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        borderTop: "1px solid #e9ecef",
        paddingTop: 8
      }}>
        <button
          type="button"
          onClick={handleEdit}
          data-testid={`commande-edit-${commande?.id ?? 'unknown'}`}
          style={{
            padding: "6px 12px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            pointerEvents: 'auto',
            fontSize: "14px",
            fontWeight: "500",
            height: "32px"
          }}
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={handleDelete}
          data-testid={`commande-delete-${commande?.id ?? 'unknown'}`}
          style={{
            padding: "6px 12px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            pointerEvents: 'auto',
            fontSize: "14px",
            fontWeight: "500",
            height: "32px"
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

CommandeCard.propTypes = {
  commande: PropTypes.object,
  cmd: PropTypes.object, // compat
  onStatusChange: PropTypes.func,
  onStatutChange: PropTypes.func, // compat
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onDeballeChange: PropTypes.func,
  onToggleDeballe: PropTypes.func, // compat
  hideADeballerUI: PropTypes.bool,
  livraisonLabel: PropTypes.string,
  debutLabel: PropTypes.string,
  finLabel: PropTypes.string,
  t: PropTypes.number,
  coefAffiche: PropTypes.string,
}
