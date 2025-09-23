import React, { useState } from "react";
import StatusBadge from "../../../components/common/StatusBadge";
import { convertDecimalToTime } from "../../../utils/time";
import { STATUTS } from "../utils/statut";

export default function CommandeCard({
  cmd,
  onEdit,
  onDelete,
  onStatutChange,
  onDeballeChange,
  hideADeballerUI = false,
  livraisonLabel,
  debutLabel,
  finLabel,
  t,
  coefAffiche
}) {
  const [savingDeballe, setSavingDeballe] = useState(false);
  const [deballeLocal, setDeballeLocal] = useState(cmd.deballe || false);

  const handleDeballeChange = async (checked) => {
    setSavingDeballe(true);
    setDeballeLocal(checked);
    try {
      await onDeballeChange(cmd.id, checked);
    } finally {
      setSavingDeballe(false);
    }
  };

  return (
    <div
      className="carte-commande"
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}
    >
      {!hideADeballerUI && !deballeLocal && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: "#ff6b35",
            color: "white",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: "bold"
          }}
          title="Commande à déballer"
        >
          À déballer
        </div>
      )}

      <div
        className="carte-commande__header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}
      >
        <h3 style={{ margin: 0 }}>Commande #{cmd.numero}</h3>
        <StatusBadge statut={cmd.statut || "A commencer"} />
      </div>

      {!hideADeballerUI && (
        <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={deballeLocal}
            onChange={(e) => handleDeballeChange(e.target.checked)}
            disabled={savingDeballe}
          />
          <span>Commande déballée {savingDeballe ? "…" : ""}</span>
        </p>
      )}

      <p><strong>Client :</strong> {cmd.client}</p>
      {Array.isArray(cmd.types) && cmd.types.length > 0 && (
        <p><strong>Types textile :</strong> {cmd.types.join(", ")}</p>
      )}
      <p><strong>Quantité :</strong> {cmd.quantite}</p>
      <p><strong>Points :</strong> {cmd.points}</p>
      <p><strong>Urgence :</strong> {cmd.urgence}</p>
      <p><strong>Livraison :</strong> {livraisonLabel || "—"}</p>

      <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Statut :</strong>{" "}
        <StatusBadge statut={cmd.statut || "A commencer"} size="sm" />
        <select
          value={cmd.statut || "A commencer"}
          onChange={(e) => onStatutChange(cmd.id, e.target.value)}
          style={{ marginLeft: 8 }}
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </p>

      {debutLabel && <p><strong>Début de commande :</strong> {debutLabel}</p>}
      {finLabel &&   <p><strong>Fin de commande :</strong> {finLabel}</p>}
      {cmd.machineAssignee && <p><strong>Machine :</strong> {cmd.machineAssignee}</p>}

      {(cmd.linked_commande_id || cmd.same_machine_as_linked || cmd.start_after_linked) && (
        <div className="bloc-liaison-info">
          <strong>Liaison :</strong>{" "}
          {cmd.linked_commande_id ? `#${cmd.linked_commande_id}` : "—"} •{" "}
          {cmd.same_machine_as_linked ? "Même machine" : "Machine différente"} •{" "}
          {cmd.start_after_linked ? "Après la liée" : "Parallèle"}
        </div>
      )}

      <p>
        <strong>Durée totale :</strong> {convertDecimalToTime(t ?? 0)}
        {coefAffiche ? <em style={{ marginLeft: 6, opacity: 0.7 }}>({coefAffiche}% appliqué)</em> : null}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onEdit(cmd)}
          style={{
            padding: "6px 12px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          Modifier
        </button>
        <button
          onClick={() => onDelete(cmd.id)}
          style={{
            padding: "6px 12px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
